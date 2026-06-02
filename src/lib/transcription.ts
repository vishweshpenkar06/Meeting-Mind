import { OpenAI } from "openai";
import { extractAudioFromFile, splitAudioIntoChunks } from "./audio-extractor";

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

export async function transcribeAudio(
  audioBlob: Blob,
  mimeType?: string
): Promise<string> {
  const inputBuffer = Buffer.from(await audioBlob.arrayBuffer());
  const fileName = mimeType?.includes("video/") ? "recording.mp4" : "audio.webm";

  return transcribeMediaFile(inputBuffer, mimeType || audioBlob.type || "application/octet-stream", fileName);
}

export async function transcribeMediaFile(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const extracted = await extractAudioFromFile(fileBuffer, mimeType, fileName);
  const chunks = await splitAudioIntoChunks(extracted.buffer, extracted.mimeType, extracted.fileName);

  const transcriptions = await Promise.all(
    chunks.map(async (chunk) => {
      const file = new File([new Uint8Array(chunk.buffer)], chunk.fileName, { type: chunk.mimeType });
      const result = (await client.audio.transcriptions.create({
        file,
        model: process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo",
        response_format: "text",
      })) as string | { text: string };

      return typeof result === "string" ? result : result.text;
    })
  );

  return transcriptions.join(" ").replace(/\s+/g, " ").trim();
}
