import { pipeline } from "@huggingface/transformers";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WaveFile } from "wavefile";

export interface AIMeetingResult {
  title: string;
  summary: string;
  decisions: string[];
  actionItems: Array<{
    owner: string;
    task: string;
    dueDate: string | null;
  }>;
}

type WhisperTranscriberOptions = {
  chunk_length_s?: number;
  stride_length_s?: number;
  return_timestamps?: boolean | "word";
  task?: "transcribe" | "translate" | string;
  language?: string;
};

type WhisperTranscriberResult =
  | string
  | {
      text?: string;
      chunks?: Array<{ timestamp?: [number, number]; text: string }>;
    };

type WhisperTranscriber = (
  audio: Float32Array,
  options?: WhisperTranscriberOptions
) => Promise<WhisperTranscriberResult>;

let asrPromise: Promise<WhisperTranscriber> | null = null;

async function getAsrPipeline() {
  if (!asrPromise) {
    asrPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny") as Promise<WhisperTranscriber>;
  }

  return asrPromise;
}

async function runFfmpeg(args: string[]): Promise<void> {
  const binaryPath = ffmpegPath;
  if (!binaryPath) {
    throw new Error("FFmpeg binary not available");
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binaryPath, args, { windowsHide: true });

    child.once("error", reject);
    child.once("close", (code: number | null) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });
}

async function normalizeMediaBlobToAudioPath(blob: Blob, mimeType?: string): Promise<{ tempRoot: string; audioPath: string }> {
  const type = mimeType || blob.type || "application/octet-stream";
  const isWav = type.includes("wav");

  const tempRoot = await mkdtemp(join(tmpdir(), "meetingmind-"));
  const inputExt = type.includes("webm") ? "webm" : type.includes("mov") ? "mov" : type.includes("wav") ? "wav" : type.includes("mp3") ? "mp3" : "bin";
  const inputPath = join(tempRoot, `input.${inputExt}`);
  const audioPath = join(tempRoot, "audio.wav");

  try {
    await writeFile(inputPath, Buffer.from(await blob.arrayBuffer()));

    if (!isWav) {
      await runFfmpeg([
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        audioPath,
      ]);
    } else {
      await runFfmpeg([
        "-y",
        "-i",
        inputPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        audioPath,
      ]);
    }

    return { tempRoot, audioPath };
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

async function loadAudioSamplesFromWav(wavPath: string): Promise<Float32Array> {
  const buffer = Buffer.from(await readFile(wavPath));
  const wav = new WaveFile(buffer);
  wav.toBitDepth("32f");
  wav.toSampleRate(16000);

  let audioData = wav.getSamples() as unknown as Float32Array | Float32Array[];
  if (Array.isArray(audioData)) {
    if (audioData.length > 1) {
      const scalingFactor = Math.sqrt(2);
      for (let i = 0; i < audioData[0].length; i += 1) {
        audioData[0][i] = (scalingFactor * (audioData[0][i] + audioData[1][i])) / 2;
      }
    }

    audioData = audioData[0];
  }

  return audioData;
}


export async function transcribeAudio(
  audioBlob: Blob,
  mimeType?: string
): Promise<string> {
  const { tempRoot, audioPath } = await normalizeMediaBlobToAudioPath(audioBlob, mimeType);

  try {
    const transcriber = await getAsrPipeline();
    const audioData = await loadAudioSamplesFromWav(audioPath);
    const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
      task: "transcribe",
      language: "en",
    });

    if (typeof result === "string") {
      return result;
    }

    if (result && typeof result === "object" && "text" in result && typeof (result as { text?: unknown }).text === "string") {
      return (result as { text: string }).text;
    }

    return "";
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
