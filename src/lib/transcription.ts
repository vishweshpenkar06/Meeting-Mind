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

const SYSTEM_PROMPT = `You are an expert meeting analyst. Extract structured, actionable insights from meeting transcripts. Always return valid JSON matching the specified schema. Be precise and concise — never invent information not present in the transcript.

For action item due dates, use these rules:
- If a specific date is mentioned, return it in ISO format (YYYY-MM-DD)
- If a relative day is mentioned ("tomorrow", "next Friday"), return the most logical date
- If no deadline is mentioned, return null
- If the date is ambiguous, return null

For owner names:
- Use the person's actual name from the transcript
- If no owner is mentioned, use "Unassigned"`;

const USER_PROMPT = `Analyze this meeting transcript and extract:
1. A meeting title (5 words max)
2. A concise summary (3-5 sentences, key themes only)
3. Key decisions made (array of strings — bullet points)
4. Action items: each with owner (person's name or "Unassigned"), task (clear description), and dueDate (ISO date string or null)

Return ONLY valid JSON in this format:
{
  "title": "string",
  "summary": "string",
  "decisions": ["string"],
  "actionItems": [
    { "owner": "string", "task": "string", "dueDate": "string or null" }
  ]
}

No markdown, no explanation, no code blocks. Just the raw JSON.

Transcript:
---
{{TRANSCRIPT}}
---`;

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
