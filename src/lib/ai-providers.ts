import { OpenAI } from "openai";
import type { AIMeetingResult } from "./transcription";

export type AIProvider = "openai" | "groq" | "openrouter" | "ollama";

interface ProviderConfig {
  name: AIProvider;
  apiKey?: string;
  baseURL?: string;
  model: string;
}

const SYSTEM_PROMPT = `You are an expert meeting analyst and technical writer. Your job is to transform raw meeting transcripts into comprehensive, structured meeting notes that someone who missed the meeting could read and fully understand what happened, why, and what comes next.

CORE PRINCIPLES:
- Write for the reader, not the transcript. Synthesize, don't copy-paste.
- Preserve all specific names, numbers, dates, metrics, and technical details exactly as stated.
- Distinguish between facts discussed vs. opinions expressed vs. decisions finalized.
- Never invent information, owners, dates, or commitments not present in the transcript.
- Identify the meeting's core purpose and evaluate whether it was achieved.

ANALYSIS APPROACH:
1. Read the entire transcript first to understand the full context.
2. Identify the primary topic and any secondary topics.
3. Track who said what (even if you can't name them, track positions/roles).
4. Note tensions, disagreements, and how they were resolved (or not).
5. Extract concrete commitments with owners and timelines.
6. Identify open questions and deferred items.`;

const USER_PROMPT = `Analyze this meeting transcript and produce comprehensive meeting notes.

Return ONLY valid JSON in this exact format:

{
  "title": "string (5-8 words, descriptive of the meeting's purpose)",
  "summary": "string (detailed multi-paragraph summary, 150-400 words)",
  "decisions": [
    {
      "decision": "string (what was decided)",
      "context": "string (why this was decided, what problem it addresses)",
      "alternativesConsidered": "string (other options discussed, or 'None mentioned')",
      "impact": "string (what this decision affects or enables)"
    }
  ],
  "actionItems": [
    {
      "owner": "string (person or team responsible)",
      "task": "string (specific, actionable description)",
      "dueDate": "string (ISO date YYYY-MM-DD) or null",
      "priority": "critical | high | medium | low",
      "context": "string (why this matters, what it unblocks)"
    }
  ],
  "keyTopics": ["string (main themes/topics discussed, 3-7 items)"],
  "risks": [
    {
      "risk": "string (what could go wrong or is blocking progress)",
      "mitigation": "string (proposed solution or 'No mitigation discussed')"
    }
  ],
  "followUps": ["string (questions raised but unanswered, items deferred to future meetings)"]
}

SUMMARY GUIDELINES:
- Write 2-4 paragraphs covering: (1) meeting purpose and attendees/roles if mentioned, (2) main discussion points and viewpoints expressed, (3) conclusions and agreements reached, (4) current status and next steps.
- Use specific details: names, metrics, dates, product names, technical terms.
- If there were disagreements, describe both sides and the resolution.
- Write in past tense for what happened, present tense for current state.

DECISION GUIDELINES:
- Only include actual decisions, not opinions or suggestions.
- If someone proposed something but it wasn't finalized, put it in followUps instead.
- Include the reasoning behind the decision when stated.

ACTION ITEM GUIDELINES:
- Each item must be specific and actionable (not "discuss X" but "draft proposal for X by Friday").
- Priority: critical = blocks others, high = needed this week, medium = needed this sprint, low = nice to have.
- If a task was implied but not explicitly assigned, use "Unassigned Backlog" as owner.

RISK GUIDELINES:
- Identify real risks: dependencies, deadlines at risk, resource gaps, technical debt, unresolved disagreements.
- Only include risks that were actually mentioned or clearly implied.

No markdown code blocks. No explanation outside the JSON. Just the raw JSON object.

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

function extractSentences(text: string): string[] {
  return text
    .split(/(?:\.\s+|\?\s+|!\s+|\n+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

function extractTopics(text: string): string[] {
  const words = text.toLowerCase().split(/\W+/);
  const freq: Record<string, number> = {};
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "shall", "this", "that", "these", "those", "it", "its", "we", "our", "you", "your", "they", "them", "their", "i", "me", "my", "he", "she", "him", "her", "not", "no", "but", "and", "or", "so", "if", "then", "than", "too", "very", "just", "about", "also", "into", "out", "up", "down", "all", "each", "every", "both", "few", "more", "most", "other", "some", "such", "only", "own", "same", "what", "which", "who", "whom", "when", "where", "why", "how", "any", "there", "here"]);

  for (const w of words) {
    if (w.length > 3 && !stopWords.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

function generateFallbackMeetingResult(transcript: string): AIMeetingResult {
  const cleaned = transcript.trim();
  const sentences = extractSentences(cleaned);

  const titleWords = cleaned.split(/\s+/).slice(0, 6);
  const title = titleWords.length > 0 ? titleWords.join(" ") : "Untitled Meeting";

  const summaryParagraphs: string[] = [];
  if (sentences.length > 0) {
    summaryParagraphs.push(
      `This meeting covered ${sentences.length > 5 ? "multiple topics" : "several points"}. ` +
      `The transcript contains approximately ${cleaned.split(/\s+/).length} words of discussion content.`
    );
    if (sentences.length > 3) {
      summaryParagraphs.push(
        `Key points discussed included: ${sentences.slice(0, 3).map((s) => s.replace(/\.$/, "")).join("; ")}.`
      );
    }
    if (sentences.length > 6) {
      summaryParagraphs.push(
        `Additional discussion covered: ${sentences.slice(3, 6).map((s) => s.replace(/\.$/, "")).join("; ")}.`
      );
    }
  } else {
    summaryParagraphs.push("Meeting notes could not be automatically generated from this transcript. Please review the raw transcript for details.");
  }

  const actionCandidates = sentences.filter((s) =>
    /\b(action|todo|follow up|follow-up|need to|should|will|must|deadline|deliver|complete|finish|send|review|create|update|fix|implement|deploy|schedule)\b/i.test(s)
  );

  const decisionSentences = sentences.filter((s) =>
    /\b(decided|decision|agreed|approved|confirmed|chosen|selected|going with|settle on|finalized)\b/i.test(s)
  );

  const riskSentences = sentences.filter((s) =>
    /\b(risk|blocker|blocked|delay|problem|issue|concern|depend|waiting on|stuck|behind|delayed|at risk)\b/i.test(s)
  );

  const followUpSentences = sentences.filter((s) =>
    /\b(question|unsure|need to check|look into|circle back|revisit|tbd|to be determined|defer|postpone|next time|follow up)\b/i.test(s)
  );

  return {
    title,
    summary: summaryParagraphs.join("\n\n"),
    decisions: decisionSentences.slice(0, 5).map((s) => ({
      decision: s.replace(/^[-*\d.\s]+/, "").trim(),
      context: "Extracted from transcript context",
      alternativesConsidered: "Not explicitly mentioned",
      impact: "Affects ongoing project direction",
    })),
    actionItems: actionCandidates.slice(0, 8).map((s) => ({
      owner: "Unassigned Backlog",
      task: s.replace(/^[-*\d.\s]+/, "").trim(),
      dueDate: null,
      priority: "medium" as const,
      context: "Identified from transcript discussion",
    })),
    keyTopics: extractTopics(cleaned),
    risks: riskSentences.slice(0, 3).map((s) => ({
      risk: s.replace(/^[-*\d.\s]+/, "").trim(),
      mitigation: "No mitigation discussed",
    })),
    followUps: followUpSentences.slice(0, 5).map((s) => s.replace(/^[-*\d.\s]+/, "").trim()),
  };
}

export async function processMeetingWithAI(transcript: string, templateContext?: string): Promise<AIMeetingResult> {
  const providers = makeProviders();

  const isPlaceholder = /automatic speech transcription was unavailable|transcription was unavailable|could not be generated/i.test(transcript);
  if (isPlaceholder) {
    return {
      title: "Meeting (Transcription Failed)",
      summary: "The audio/video transcription failed before analysis. The meeting could not be analyzed because no transcript was available.\n\nPossible causes:\n- GROQ_API_KEY is not set or invalid\n- The audio/video file could not be processed\n- FFmpeg is not available for video audio extraction\n\nTo fix this:\n1. Ensure GROQ_API_KEY is set in .env.local (get one free at console.groq.com)\n2. Try pasting the transcript manually instead of uploading",
      decisions: [],
      actionItems: [],
      keyTopics: [],
      risks: [{ risk: "Transcription pipeline is not working", mitigation: "Set GROQ_API_KEY in .env.local" }],
      followUps: [],
    };
  }

  if (providers.length === 0) {
    return generateFallbackMeetingResult(transcript);
  }

  const fullSystemPrompt = templateContext ? `${templateContext}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT;
  const errors: string[] = [];

  for (const config of providers) {
    try {
      const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
      const truncatedTranscript = transcript.length > 15000 ? transcript.slice(0, 15000) + "\n\n[Transcript truncated for analysis]" : transcript;
      const userPrompt = USER_PROMPT.replace("{{TRANSCRIPT}}", truncatedTranscript);

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

      const parsed = JSON.parse(content) as Record<string, unknown>;

      if (!parsed.title || !parsed.summary) {
        throw new Error("Invalid response: missing title or summary");
      }

      const result: AIMeetingResult = {
        title: String(parsed.title),
        summary: String(parsed.summary),
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map((d: unknown) => {
          if (typeof d === "string") return { decision: d, context: "", alternativesConsidered: "", impact: "" };
          const obj = d as Record<string, string>;
          return {
            decision: obj.decision || obj.decision_text || String(d),
            context: obj.context || "",
            alternativesConsidered: obj.alternativesConsidered || "",
            impact: obj.impact || "",
          };
        }) : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map((a: unknown) => {
          const obj = a as Record<string, string>;
          return {
            owner: obj.owner || "Unassigned Backlog",
            task: obj.task || obj.task_description || "",
            dueDate: obj.dueDate || obj.due_date || null,
            priority: obj.priority || "medium",
            context: obj.context || "",
          };
        }) : [],
        keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.map(String) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.map((r: unknown) => {
          if (typeof r === "string") return { risk: r, mitigation: "" };
          const obj = r as Record<string, string>;
          return { risk: obj.risk || "", mitigation: obj.mitigation || "" };
        }) : [],
        followUps: Array.isArray(parsed.followUps) ? parsed.followUps.map(String) : [],
      };

      return result;
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

export interface DiarizedSegment {
  speaker: string;
  text: string;
}

export async function diarizeTranscript(transcript: string): Promise<DiarizedSegment[]> {
  const providers = makeProviders();
  if (providers.length === 0 || transcript.length < 50) {
    return [{ speaker: "Speaker", text: transcript }];
  }

  const config = providers[0];
  try {
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: `You are a transcript analyst. Your job is to identify different speakers in a meeting transcript and label each segment.

Rules:
- Assign speaker labels: "Speaker A", "Speaker B", "Speaker C", etc.
- Each time the speaker changes, start a new segment
- Keep the original text exactly as-is, just add speaker labels
- If you cannot determine speaker changes, return the entire text as one segment with "Speaker A"
- Return ONLY valid JSON array, no explanation

Return format:
[{"speaker": "Speaker A", "text": "..."}, {"speaker": "Speaker B", "text": "..."}]`
        },
        {
          role: "user",
          content: `Diarize this transcript:\n\n${transcript.slice(0, 12000)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return [{ speaker: "Speaker", text: transcript }];

    const parsed = JSON.parse(content) as { segments?: DiarizedSegment[] } | DiarizedSegment[];
    const segments = Array.isArray(parsed) ? parsed : parsed.segments;

    if (Array.isArray(segments) && segments.length > 0 && segments[0].speaker && segments[0].text) {
      return segments;
    }
    return [{ speaker: "Speaker", text: transcript }];
  } catch (err) {
    console.warn("Diarization failed, returning single speaker:", err);
    return [{ speaker: "Speaker", text: transcript }];
  }
}

export interface BriefingResult {
  contextSummary: string;
  pendingItems: string[];
  suggestedTopics: string[];
  risks: string[];
}

export async function generatePreMeetingBriefing(
  templateName: string,
  recentMeetings: Array<{ title: string; summary: string; action_items?: Array<{ task_description: string; is_completed: boolean; due_date: string | null }> }>,
): Promise<BriefingResult> {
  const providers = makeProviders();
  const fallback: BriefingResult = {
    contextSummary: "No recent meeting context available.",
    pendingItems: [],
    suggestedTopics: ["Review agenda items"],
    risks: [],
  };

  if (providers.length === 0) return fallback;

  const config = providers[0];
  try {
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });

    const contextData = recentMeetings.map((m) => {
      const pending = (m.action_items || []).filter((a) => !a.is_completed);
      return `Meeting: ${m.title}\nSummary: ${m.summary}\nPending: ${pending.map((p) => p.task_description).join(", ") || "none"}`;
    }).join("\n---\n");

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: `You are a meeting preparation assistant. Given context from recent meetings, generate a pre-meeting briefing.

Return ONLY valid JSON:
{
  "contextSummary": "2-3 sentence summary of recent context",
  "pendingItems": ["item1", "item2"],
  "suggestedTopics": ["topic1", "topic2", "topic3"],
  "risks": ["risk1"]
}`
        },
        {
          role: "user",
          content: `Meeting type: ${templateName}\n\nRecent meeting context:\n${contextData.slice(0, 6000)}\n\nGenerate a pre-meeting briefing.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as Partial<BriefingResult>;
    return {
      contextSummary: parsed.contextSummary || fallback.contextSummary,
      pendingItems: Array.isArray(parsed.pendingItems) ? parsed.pendingItems : [],
      suggestedTopics: Array.isArray(parsed.suggestedTopics) ? parsed.suggestedTopics : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    };
  } catch (err) {
    console.warn("Briefing generation failed:", err);
    return fallback;
  }
}
