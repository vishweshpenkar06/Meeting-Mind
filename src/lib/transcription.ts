import { OpenAI } from "openai";

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


export async function transcribeAudio(
  audioBlob: Blob,
  mimeType?: string
): Promise<string> {
  const openai = await createOpenAIClient();

  // Determine the correct MIME type: use provided hint, blob.type, or default to audio/mpeg
  const type = mimeType || audioBlob.type || "audio/mpeg";

  // Derive a sensible filename from the mime type
  const ext = type.split("/")[1] || "mp3";
  const file = new File([audioBlob], `audio.${ext}`, { type });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    prompt: "Speaker A: Hello. Speaker B: Hi there. Speaker A: Let's begin the meeting.",
  });

  return transcription.text;
}
