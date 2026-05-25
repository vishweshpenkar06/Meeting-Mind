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

export async function processMeetingWithAI(transcript: string, templateContext?: string): Promise<AIMeetingResult> {
  const providers = makeProviders();
  if (providers.length === 0) {
    throw new Error("No AI providers configured. Set OPENAI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, or OLLAMA_BASE_URL.");
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

  throw new Error(`All AI providers failed:\n${errors.join("\n")}`);
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
