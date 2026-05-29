import { OpenAI } from "openai";
import type { AIMeetingResult } from "./transcription";

export type AIProvider = "openai" | "groq" | "openrouter" | "ollama";

interface ProviderConfig {
  name: AIProvider;
  apiKey?: string;
  baseURL?: string;
  model: string;
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

function makeProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL || "gpt-4o",
    });
  }

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "groq",
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      model: process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4-5",
    });
  }

  if (process.env.OLLAMA_BASE_URL) {
    providers.push({
      name: "ollama",
      baseURL: process.env.OLLAMA_BASE_URL,
      model: process.env.OLLAMA_MODEL || "llama3.1",
    });
  }

  return providers;
}

function generateFallbackMeetingResult(transcript: string): AIMeetingResult {
  const cleaned = transcript.trim();
  const sentences = cleaned
    .split(/(?:\.\s+|\?\s+|!\s+|\n+)/)
    .map((part) => part.trim())
    .filter(Boolean);

  const titleWords = cleaned.split(/\s+/).slice(0, 5);
  const title = titleWords.length > 0 ? titleWords.join(" ") : "Untitled Meeting";

  const summary = sentences.slice(0, 3).join(" ") || cleaned.slice(0, 280) || "Meeting notes could not be generated automatically.";

  const actionCandidates = sentences.filter((sentence) => /\b(action|todo|follow up|follow-up|need to|should|will)\b/i.test(sentence));
  const decisions = sentences
    .filter((sentence) => /\b(decided|decision|agreed|approved|confirmed)\b/i.test(sentence))
    .slice(0, 5);

  const actionItems = actionCandidates.slice(0, 5).map((sentence) => ({
    owner: "Unassigned",
    task: sentence.replace(/^[-*\d.\s]+/, "").trim(),
    dueDate: null,
  }));

  return {
    title,
    summary,
    decisions: decisions.length > 0 ? decisions : ["No explicit decisions detected in the transcript."],
    actionItems: actionItems.length > 0 ? actionItems : [
      {
        owner: "Unassigned",
        task: "Review transcript and extract concrete follow-up tasks.",
        dueDate: null,
      },
    ],
  };
}

export async function processMeetingWithAI(transcript: string, templateContext?: string): Promise<AIMeetingResult> {
  const providers = makeProviders();
  if (providers.length === 0) {
    return generateFallbackMeetingResult(transcript);
  }

  const fullSystemPrompt = templateContext ? `${templateContext}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT;
  const errors: string[] = [];

  for (const config of providers) {
    try {
      const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
      const userPrompt = USER_PROMPT.replace("{{TRANSCRIPT}}", transcript);

      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: fullSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response");

      const parsed = JSON.parse(content) as AIMeetingResult;
      if (!parsed.title || !parsed.summary || !Array.isArray(parsed.decisions) || !Array.isArray(parsed.actionItems)) {
        throw new Error("Invalid response structure");
      }
      return parsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      errors.push(`${config.name}: ${msg}`);
      console.warn(`Provider ${config.name} failed:`, msg);
    }
  }

  console.warn(`All AI providers failed, using fallback notes generator:\n${errors.join("\n")}`);
  return generateFallbackMeetingResult(transcript);
}

export async function analyzeSentiment(transcript: string): Promise<number> {
  const providers = makeProviders();
  if (providers.length === 0) return 0;

  const config = providers[0];
  const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });

  const completion = await openai.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: "Analyze the sentiment of this meeting transcript. Return ONLY a single integer from -100 (very negative/hostile) to 100 (very positive/constructive). No explanation, just the number." },
      { role: "user", content: transcript.slice(0, 8000) },
    ],
    temperature: 0.1,
  });

  const content = completion.choices[0]?.message?.content;
  const score = content ? parseInt(content.trim(), 10) : 0;
  if (isNaN(score)) return 0;
  return Math.max(-100, Math.min(100, score));
}

export async function getAvailableProviders(): Promise<{ name: string; model: string }[]> {
  return makeProviders().map((p) => ({ name: p.name, model: p.model }));
}
