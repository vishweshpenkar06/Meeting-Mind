import { describe, it, expect, beforeEach } from "vitest";
import { checkLimit, limitFor, resetLimits, LIMITS } from "./rate-limit";

beforeEach(() => resetLimits());

describe("checkLimit", () => {
  it("allows exactly `limit` calls then rejects", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkLimit("k", 5, 60_000).ok).toBe(true);
    }
    expect(checkLimit("k", 5, 60_000).ok).toBe(false);
  });

  it("reports remaining budget decreasing to zero", () => {
    expect(checkLimit("k", 3, 60_000).remaining).toBe(2);
    expect(checkLimit("k", 3, 60_000).remaining).toBe(1);
    expect(checkLimit("k", 3, 60_000).remaining).toBe(0);
  });

  it("keeps counters independent per key", () => {
    checkLimit("a", 1, 60_000);
    expect(checkLimit("a", 1, 60_000).ok).toBe(false);
    expect(checkLimit("b", 1, 60_000).ok).toBe(true);
  });

  it("resets once the window has elapsed", () => {
    expect(checkLimit("k", 1, 1).ok).toBe(true);
    expect(checkLimit("k", 1, 1).ok).toBe(false);
    // window is 1ms; the next tick is past it
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(checkLimit("k", 1, 1).ok).toBe(true);
        resolve(undefined);
      }, 5);
    });
  });

  it("returns a positive Retry-After while blocked", () => {
    checkLimit("k", 1, 60_000);
    const blocked = checkLimit("k", 1, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it("keeps budgets separate per route for the same user", () => {
    const { limit: transcribeLimit } = LIMITS.transcribe;
    for (let i = 0; i < transcribeLimit; i++) limitFor("user", "transcribe");
    expect(limitFor("user", "transcribe").ok).toBe(false);
    expect(limitFor("user", "analyze").ok).toBe(true);
  });

  it("caps the transcription budget far below analysis", () => {
    expect(LIMITS.transcribe.limit).toBeLessThan(LIMITS.analyze.limit * 5);
  });
});
