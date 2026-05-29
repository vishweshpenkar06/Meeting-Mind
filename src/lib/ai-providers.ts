import { OpenAI } from "openai";
import type { AIMeetingResult } from "./transcription";

export type AIProvider = "openai" | "groq" | "openrouter" | "ollama";

interface ProviderConfig {
  name: AIProvider;
  apiKey?: string;
  baseURL?: string;
  model: string;
}

const SYSTEM_PROMPT = `You are an elite Technical Program Manager and Systems Engineer analyzing chaotic, jargon-dense meeting transcripts.

Your objective is to synthesize precise, highly accurate technical documentation, architectural root causes, and explicit action items.

Processing rules:
- Resolve ambiguous pronouns to the exact systems, incidents, commits, services, or infrastructure assets being discussed.
- Build a chronological causal chain. Prefer linear root-cause analysis over disjoint bug lists.
- Extract strategic decisions as state changes. Capture rejected paths and approved paths when they are explicitly discussed.
- Do not invent facts, owners, systems, metrics, or deadlines.
- Keep hardcoded technical metrics, timestamps, status codes, names, and configuration values accurate.
- Do not extract passive descriptions or warnings as tasks.
- Do not create unassigned action items. If a task is critical but no owner is explicitly stated, label the owner as "Unassigned Backlog".

Return valid JSON matching the required schema. The summary should be written like technical notes with root-cause detail, and the decisions array should capture approved/rejected paths when mentioned.`;

const USER_PROMPT = `Analyze this meeting transcript and extract:
1. A meeting title (5 words max)
2. A concise technical summary (3-5 sentences) with causal chain and root cause where applicable
3. Key decisions made, including rejected paths and approved paths when present
4. Action items: each with owner, task, and dueDate (ISO date string or null)

Return ONLY valid JSON in this format:
{
  "title": "string",
  "summary": "string",
  "decisions": ["string"],
  "actionItems": [
    { "owner": "string", "task": "string", "dueDate": "string or null" }
  ]
}

Rules for action items:
- If a due date is explicitly mentioned, convert it to ISO format (YYYY-MM-DD) when possible.
- If no due date is mentioned, return null.
- If no owner is explicitly stated, use "Unassigned Backlog".

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
    owner: "Unassigned Backlog",
    task: sentence.replace(/^[-*\d.\s]+/, "").trim(),
    dueDate: null,
  }));

  return {
    title,
    summary,
    decisions: decisions.length > 0 ? decisions : ["No explicit decisions detected in the transcript."],
    actionItems: actionItems.length > 0 ? actionItems : [
      {
        owner: "Unassigned Backlog",
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
