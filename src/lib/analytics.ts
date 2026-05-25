export interface MeetingQualityMetrics {
  meetingId: string;
  sentimentPct: number;
  engagementPct: number;
  monologuePct: number;
  actionCompletionPct: number;
  participantCount: number;
}

export function estimateDurationFromTranscript(text: string): number {
  const wordCount = text.split(/\s+/).length;
  const avgWpm = 150;
  return Math.round((wordCount / avgWpm) * 60);
}

export function estimateEngagement(speakers: Set<string>, totalWords: number): number {
  const speakerCount = speakers.size;
  if (speakerCount <= 1) return 0;
  if (speakerCount === 2) return 60;
  const ratio = speakerCount / Math.max(totalWords / 500, 1);
  return Math.min(100, Math.round(ratio * 50));
}

export function estimateMonologue(wordCounts: Record<string, number>): number {
  const entries = Object.entries(wordCounts);
  if (entries.length <= 1) return 100;
  const total = entries.reduce((s, [, c]) => s + c, 0);
  const maxWords = Math.max(...entries.map(([, c]) => c));
  return Math.round((maxWords / total) * 100);
}
