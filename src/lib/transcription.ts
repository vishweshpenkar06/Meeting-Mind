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

interface TranscriptionProvider {
  name: string;
  client: OpenAI;
  model: string;
}

function getTranscriptionProviders(): TranscriptionProvider[] {
  const providers: TranscriptionProvider[] = [];

  if (process.env.NVIDIA_API_KEY) {
    providers.push({
      name: "nvidia",
      client: new OpenAI({
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: "https://integrate.api.nvidia.com/v1",
      }),
      model: process.env.NVIDIA_TRANSCRIPTION_MODEL || "nvidia/parakeet-tdt-0.6b-v2",
    });
  }

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "groq",
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo",
    });
  }

  return providers;
}

async function sendToTranscription(
  provider: TranscriptionProvider,
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  language?: string
): Promise<string> {
  console.log(`[transcribe] Sending to ${provider.name}: ${fileName}, type: ${mimeType}, size: ${(buffer.length / 1024).toFixed(0)}KB, language: ${language || "auto"}`);
  const file = new File([new Uint8Array(buffer)], fileName, { type: mimeType });
  const params: Record<string, unknown> = {
    file,
    model: provider.model,
    response_format: "text",
  };
  if (language && language !== "auto") {
    params.language = language;
  }
  const result = (await provider.client.audio.transcriptions.create(params as never)) as string | { text: string };

  const text = typeof result === "string" ? result : result.text;
  console.log(`[transcribe] ${provider.name} result: ${text?.length || 0} chars`);
  return text;
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

export async function transcribeMediaFile(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  language?: string
): Promise<string> {
  const providers = getTranscriptionProviders();
  if (providers.length === 0) {
    throw new Error("No transcription provider configured. Set NVIDIA_API_KEY or GROQ_API_KEY in .env.local");
  }

  const extracted = await extractAudioFromFile(fileBuffer, mimeType, fileName);
  const chunks = await splitAudioIntoChunks(extracted.buffer, extracted.mimeType, extracted.fileName);

  for (const provider of providers) {
    try {
      const transcriptions = await Promise.all(
        chunks.map(async (chunk) => {
          return sendToTranscription(provider, chunk.buffer, chunk.mimeType, chunk.fileName, language);
        })
      );

      return transcriptions.join(" ").replace(/\s+/g, " ").trim();
    } catch (providerError) {
      console.warn(`Transcription failed with ${provider.name}:`, providerError instanceof Error ? providerError.message : providerError);
    }
  }

  for (const provider of providers) {
    try {
      console.warn(`[transcribe] All chunked transcription failed, trying direct transcription with ${provider.name}`);
      const result = await sendToTranscription(provider, fileBuffer, mimeType, fileName, language);
      return result.replace(/\s+/g, " ").trim();
    } catch {
      // continue to next provider
    }
  }

  throw new Error(`Transcription failed with all providers (${providers.map((p) => p.name).join(", ")}). Check that your API keys are valid.`);
}
