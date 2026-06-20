import { OpenAI } from "openai";
import { extractAudioFromFile, splitAudioIntoChunks } from "./audio-extractor";

export interface AIMeetingResult {
  title: string;
  summary: string;
  decisions: Array<{
    decision: string;
    context?: string;
    alternativesConsidered?: string;
    impact?: string;
  } | string>;
  actionItems: Array<{
    owner: string;
    task: string;
    dueDate: string | null;
    priority?: string;
    context?: string;
  }>;
  keyTopics?: string[];
  risks?: Array<{ risk: string; mitigation?: string }>;
  followUps?: string[];
}

export async function transcribeAudio(
  audioBlob: Blob,
  mimeType?: string,
  language?: string
): Promise<string> {
  const inputBuffer = Buffer.from(await audioBlob.arrayBuffer());
  const fileName = mimeType?.includes("video/") ? "recording.mp4" : "audio.webm";

  return transcribeMediaFile(inputBuffer, mimeType || audioBlob.type || "application/octet-stream", fileName, language);
}

async function sendToWhisper(
  client: OpenAI,
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  language?: string
): Promise<string> {
  const file = new File([new Uint8Array(buffer)], fileName, { type: mimeType });
  const params: Record<string, unknown> = {
    file,
    model: process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo",
    response_format: "text",
  };
  if (language && language !== "auto") {
    params.language = language;
  }
  const result = (await client.audio.transcriptions.create(params as never)) as string | { text: string };

  return typeof result === "string" ? result : result.text;
}

export async function transcribeMediaFile(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  language?: string
): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured. Get one at https://console.groq.com");
  }

  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  try {
    const extracted = await extractAudioFromFile(fileBuffer, mimeType, fileName);
    const chunks = await splitAudioIntoChunks(extracted.buffer, extracted.mimeType, extracted.fileName);

    const transcriptions = await Promise.all(
      chunks.map(async (chunk) => {
        return sendToWhisper(client, chunk.buffer, chunk.mimeType, chunk.fileName, language);
      })
    );

    return transcriptions.join(" ").replace(/\s+/g, " ").trim();
  } catch (extractionError) {
    console.warn("Audio extraction failed, attempting direct transcription:", extractionError);

    try {
      const result = await sendToWhisper(client, fileBuffer, mimeType, fileName, language);
      return result.replace(/\s+/g, " ").trim();
    } catch (directError) {
      console.error("Direct transcription also failed:", directError);
      throw new Error(
        `Transcription failed. Extraction error: ${extractionError instanceof Error ? extractionError.message : "unknown"}. ` +
        `Direct error: ${directError instanceof Error ? directError.message : "unknown"}`
      );
    }
  }
}
