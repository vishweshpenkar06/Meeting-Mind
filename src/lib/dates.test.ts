import { describe, it, expect } from "vitest";
import { formatLocalDate, formatShortDate, daysUntil, relativeDayLabel, toDateOnly } from "./dates";

describe("parseDateOnly", () => {
  it("treats a Postgres date as local midnight, not UTC midnight", () => {
    // new Date("2026-03-10") is UTC midnight, which is 2026-03-09 in any negative offset zone.
    // Compare against a locally-constructed date so the assertion is locale-independent.
    const expected = new Date(2026, 2, 10);
    expect(formatShortDate("2026-03-10")).toBe(expected.toLocaleDateString());
    expect(formatLocalDate("2026-03-10")).toBe("March 10, 2026");
    expect(formatLocalDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("does not shift the day for a date-only value", () => {
    for (const value of ["2026-01-01", "2026-03-10", "2026-06-30", "2026-12-31"]) {
      const [, month, day] = value.split("-").map(Number);
      expect(formatLocalDate(value)).toContain(new Date(2026, month - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric" }));
    }
  });

  it("preserves a full ISO timestamp", () => {
    expect(formatShortDate("2026-03-10T23:30:00.000Z")).not.toBe("");
  });

  it("returns an empty string for missing or invalid values", () => {
    expect(formatLocalDate(null)).toBe("");
    expect(formatLocalDate(undefined)).toBe("");
    expect(formatLocalDate("")).toBe("");
    expect(formatLocalDate("not-a-date")).toBe("");
    expect(formatShortDate("not-a-date")).toBe("");
  });
});

describe("daysUntil", () => {
  const today = new Date();
  const local = (offsetDays: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  it("counts whole calendar days, not elapsed hours", () => {
    expect(daysUntil(local(0))).toBe(0);
    expect(daysUntil(local(1))).toBe(1);
    expect(daysUntil(local(7))).toBe(7);
    expect(daysUntil(local(-1))).toBe(-1);
  });

  it("returns null when there is no due date", () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil("")).toBeNull();
    expect(daysUntil("garbage")).toBeNull();
  });
});

describe("relativeDayLabel", () => {
  const today = new Date();
  const local = (offsetDays: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  it("labels today and yesterday by calendar day", () => {
    expect(relativeDayLabel(local(0))).toBe("Today");
    expect(relativeDayLabel(local(-1))).toBe("Yesterday");
  });

  it("falls back to a formatted date beyond a day", () => {
    expect(relativeDayLabel(local(-5))).toBe(formatShortDate(local(-5)));
  });
});

describe("toDateOnly", () => {
  it("normalizes to the YYYY-MM-DD shape Postgres date columns expect", () => {
    expect(toDateOnly("2026-03-10")).toBe("2026-03-10");
    expect(toDateOnly("March 10, 2026")).toBe("2026-03-10");
  });

  it("returns an empty string for unparseable input", () => {
    expect(toDateOnly("nope")).toBe("");
  });
});
