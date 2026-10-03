export interface Segment {
  speaker: string | null;
  text: string;
  start_time?: number | null;
  end_time?: number | null;
}

export interface QualityMetrics {
  participant_count: number;
  /** Share of words spoken by the most active participant, 0-100 */
  monologue_pct: number;
  /** Evenness of participation across speakers, 0-100 (100 = perfectly even) */
  engagement_pct: number;
}

/**
 * Derives talk-distribution metrics from diarized segments.
 *
 * Word-count share rather than duration: Whisper segments carry no reliable
 * timestamps for uploaded files, but every segment has text, so this works for
 * both live recordings and uploads.
 */
export function computeQualityMetrics(segments: Segment[]): QualityMetrics {
  const usable = segments.filter((s) => s.text && s.text.trim().length > 0);
  if (usable.length === 0) {
    return { participant_count: 0, monologue_pct: 0, engagement_pct: 0 };
  }

  const wordsBySpeaker = new Map<string, number>();
  for (const segment of usable) {
    const speaker = segment.speaker?.trim() || "Unknown";
    const words = segment.text.trim().split(/\s+/).filter(Boolean).length;
    wordsBySpeaker.set(speaker, (wordsBySpeaker.get(speaker) ?? 0) + words);
  }

  const participantCount = wordsBySpeaker.size;
  const shares = [...wordsBySpeaker.values()].map((w) => w / totalWords(wordsBySpeaker));

  const monologuePct = Math.round(Math.max(...shares) * 100);

  // Herfindahl-style concentration, inverted: 1 - sum(share^2), scaled 0-100
  const concentration = shares.reduce((sum, share) => sum + share * share, 0);
  const engagementPct = Math.round((1 - concentration) * 100);

  return {
    participant_count: participantCount,
    monologue_pct: Math.min(100, Math.max(0, monologuePct)),
    engagement_pct: Math.min(100, Math.max(0, engagementPct)),
  };
}

function totalWords(wordsBySpeaker: Map<string, number>): number {
  let total = 0;
  for (const words of wordsBySpeaker.values()) total += words;
  return Math.max(1, total);
}
