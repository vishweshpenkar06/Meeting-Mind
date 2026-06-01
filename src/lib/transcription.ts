import { OpenAI } from "openai";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

async function createOpenAIClient() {
  const config: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: process.env.OPENAI_API_KEY,
  };

  // OpenRouter support
  if (process.env.OPENAI_BASE_URL) {
    config.baseURL = process.env.OPENAI_BASE_URL;
  }

  return new OpenAI(config);
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

async function normalizeMediaBlobToAudioFile(blob: Blob, mimeType?: string): Promise<File> {
  const type = mimeType || blob.type || "application/octet-stream";
  const isVideo = type.startsWith("video/");

  if (!isVideo) {
    const ext = type.split("/")[1] || "mp3";
    return new File([blob], `audio.${ext}`, { type: type.startsWith("audio/") ? type : "audio/mpeg" });
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "meetingmind-"));
  const inputExt = type.includes("webm") ? "webm" : type.includes("mov") ? "mov" : "mp4";
  const inputPath = join(tempRoot, `input.${inputExt}`);
  const outputPath = join(tempRoot, "audio.mp3");

  try {
    await writeFile(inputPath, Buffer.from(await blob.arrayBuffer()));

    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      outputPath,
    ]);

    const audioBuffer = await readFile(outputPath);
    return new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}


export async function transcribeAudio(
  audioBlob: Blob,
  mimeType?: string
): Promise<string> {
  const openai = await createOpenAIClient();

  // Determine the correct MIME type: use provided hint, blob.type, or default to audio/mpeg
  const file = await normalizeMediaBlobToAudioFile(audioBlob, mimeType);

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    prompt: "Speaker A: Hello. Speaker B: Hi there. Speaker A: Let's begin the meeting.",
  });

  return transcription.text;
}
