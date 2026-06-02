import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export type NormalizedAudioFile = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

function runFfmpeg(command: (runner: ffmpeg.FfmpegCommand) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    command(
      ffmpeg()
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
    );
  });
}

function extensionForMimeType(mimeType: string, fileName: string): string {
  const lower = `${mimeType} ${fileName}`.toLowerCase();

  if (lower.includes("webm")) return "webm";
  if (lower.includes("mov")) return "mov";
  if (lower.includes("mp4")) return "mp4";
  if (lower.includes("mkv")) return "mkv";
  if (lower.includes("avi")) return "avi";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("mp3")) return "mp3";
  if (lower.includes("m4a")) return "m4a";
  return "bin";
}

function outputFileName(fileName: string, suffix: string, extension: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "audio";
  return `${baseName}${suffix}.${extension}`;
}

export async function extractAudioFromFile(
  inputBuffer: Buffer,
  inputMimeType: string,
  inputFileName: string
): Promise<NormalizedAudioFile> {
  const mimeType = inputMimeType || "application/octet-stream";
  const isAudioOnly = mimeType.startsWith("audio/");

  if (isAudioOnly && inputBuffer.length <= 24 * 1024 * 1024) {
    return {
      buffer: inputBuffer,
      mimeType,
      fileName: inputFileName,
    };
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "meetingmind-"));
  const inputExt = extensionForMimeType(mimeType, inputFileName);
  const inputPath = join(tempRoot, `input.${inputExt}`);
  const outputPath = join(tempRoot, "audio.mp3");

  try {
    await writeFile(inputPath, inputBuffer);

    await runFfmpeg((runner) => {
      runner
        .input(inputPath)
        .noVideo()
        .audioChannels(1)
        .audioFrequency(16000)
        .audioBitrate("64k")
        .format("mp3")
        .save(outputPath);
    });

    const outputBuffer = await readFile(outputPath);
    return {
      buffer: outputBuffer,
      mimeType: "audio/mpeg",
      fileName: outputFileName(inputFileName, "-audio", "mp3"),
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function splitAudioIntoChunks(
  audioBuffer: Buffer,
  mimeType: string,
  fileName: string,
  maxSizeBytes = 23 * 1024 * 1024
): Promise<NormalizedAudioFile[]> {
  if (audioBuffer.length <= maxSizeBytes) {
    return [
      {
        buffer: audioBuffer,
        mimeType,
        fileName,
      },
    ];
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "meetingmind-chunks-"));
  const inputExt = extensionForMimeType(mimeType, fileName);
  const inputPath = join(tempRoot, `input.${inputExt}`);

  try {
    await writeFile(inputPath, audioBuffer);

    const duration = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (error, metadata) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(metadata.format.duration || 0);
      });
    });

    const chunkCount = Math.max(2, Math.ceil(audioBuffer.length / maxSizeBytes));
    const chunkDuration = Math.max(15, Math.floor(duration / chunkCount) || 15);
    const chunks: NormalizedAudioFile[] = [];

    for (let index = 0; index < chunkCount; index += 1) {
      const startTime = index * chunkDuration;
      const chunkPath = join(tempRoot, `${index + 1}.mp3`);

      await runFfmpeg((runner) => {
        runner
          .input(inputPath)
          .setStartTime(startTime)
          .setDuration(chunkDuration + 2)
          .noVideo()
          .audioChannels(1)
          .audioFrequency(16000)
          .audioBitrate("64k")
          .format("mp3")
          .save(chunkPath);
      });

      chunks.push({
        buffer: await readFile(chunkPath),
        mimeType: "audio/mpeg",
        fileName: outputFileName(fileName, `-part${index + 1}`, "mp3"),
      });
    }

    return chunks;
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}