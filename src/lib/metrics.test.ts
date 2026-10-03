import { describe, it, expect } from "vitest";
import { computeQualityMetrics } from "./metrics";

const seg = (speaker: string | null, text: string) => ({ speaker, text });

describe("computeQualityMetrics", () => {
  it("returns zeroes for no usable segments", () => {
    expect(computeQualityMetrics([])).toEqual({
      participant_count: 0,
      monologue_pct: 0,
      engagement_pct: 0,
    });
    expect(computeQualityMetrics([seg("A", "   ")])).toEqual({
      participant_count: 0,
      monologue_pct: 0,
      engagement_pct: 0,
    });
  });

  it("counts distinct speakers", () => {
    const result = computeQualityMetrics([
      seg("Speaker A", "one two three"),
      seg("Speaker B", "four five"),
      seg("Speaker A", "six"),
    ]);
    expect(result.participant_count).toBe(2);
  });

  it("groups unattributed speech under one bucket", () => {
    const result = computeQualityMetrics([seg(null, "one two"), seg(undefined as unknown as string, "three")]);
    expect(result.participant_count).toBe(1);
    expect(result.monologue_pct).toBe(100);
  });

  it("flags a monologue when one speaker dominates", () => {
    const result = computeQualityMetrics([
      seg("A", "one two three four five six seven eight nine ten"),
      seg("B", "hi"),
    ]);
    expect(result.monologue_pct).toBeGreaterThan(85);
  });

  it("scores balanced participation as highly engaged", () => {
    const result = computeQualityMetrics([
      seg("A", "one two three four five"),
      seg("B", "six seven eight nine ten"),
    ]);
    expect(result.engagement_pct).toBe(50);
    expect(result.monologue_pct).toBe(50);
  });

  it("scores a two-person split as better than a monologue", () => {
    const balanced = computeQualityMetrics([seg("A", "a b c d e"), seg("B", "f g h i j")]);
    const lopsided = computeQualityMetrics([seg("A", "a b c d e"), seg("B", "f")]);
    expect(balanced.engagement_pct).toBeGreaterThan(lopsided.engagement_pct);
  });

  it("never emits out-of-range percentages", () => {
    const many = Array.from({ length: 20 }, (_, i) => seg(`S${i}`, "word"));
    const one = computeQualityMetrics(many);
    expect(one.engagement_pct).toBeGreaterThanOrEqual(0);
    expect(one.engagement_pct).toBeLessThanOrEqual(100);
    expect(one.monologue_pct).toBeGreaterThanOrEqual(0);
    expect(one.monologue_pct).toBeLessThanOrEqual(100);
  });
});
