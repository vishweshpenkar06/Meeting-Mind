/**
 * Fixed-window rate limiter, keyed by user id.
 *
 * In-process only: state lives in a module-level Map, so limits are per
 * instance. That is correct for a single Node process and for local dev, but a
 * multi-instance deploy needs shared state (Redis/Upstash) or the effective
 * limit becomes N times the configured one. See `checkLimit` callers for the
 * ceiling comment.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Bound memory: drop expired windows on write, and hard-cap the map so a flood
// of distinct keys cannot grow it without limit.
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface LimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export function checkLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) sweep(now);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfter };
  }
  return { ok: true, remaining: limit - existing.count, retryAfter };
}

/**
 * Per-route budgets. Weights reflect relative cost: transcription is ~20x a
 * summary call, so it gets a far tighter ceiling.
 */
export const LIMITS = {
  transcribe: { limit: 120, windowMs: 60 * 60 * 1000 },
  analyze: { limit: 30, windowMs: 60 * 60 * 1000 },
  agenda: { limit: 40, windowMs: 60 * 60 * 1000 },
  briefing: { limit: 40, windowMs: 60 * 60 * 1000 },
  create: { limit: 20, windowMs: 60 * 60 * 1000 },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Route label is part of the key so budgets do not bleed across endpoints. */
export function limitFor(userId: string, route: LimitName): LimitResult {
  const { limit, windowMs } = LIMITS[route];
  return checkLimit(`${route}:${userId}`, limit, windowMs);
}

/** Test seam — clears all counters. */
export function resetLimits() {
  windows.clear();
}
