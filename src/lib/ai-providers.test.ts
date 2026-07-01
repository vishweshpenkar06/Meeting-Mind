import { describe, it, expect } from "vitest";

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

describe("ai-providers helper functions", () => {
  describe("extractSentences", () => {
    it("splits text by periods", () => {
      const result = extractSentences("First sentence. Second sentence. Third sentence.");
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("First sentence");
    });

    it("filters out short sentences", () => {
      const result = extractSentences("Hi. This is a longer sentence that should be kept.");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("longer sentence");
    });

    it("splits by newlines", () => {
      const result = extractSentences("First paragraph content.\nSecond paragraph content.");
      expect(result).toHaveLength(2);
    });

    it("handles empty input", () => {
      const result = extractSentences("");
      expect(result).toHaveLength(0);
    });

    it("trims whitespace", () => {
      const result = extractSentences("  Hello world.  ");
      expect(result[0]).toBe("Hello world");
    });
  });

  describe("extractTopics", () => {
    it("extracts most frequent words", () => {
      const text = "deploy deploy deploy testing testing release";
      const topics = extractTopics(text);
      expect(topics).toContain("Deploy");
      expect(topics).toContain("Testing");
      expect(topics).toContain("Release");
    });

    it("filters stop words", () => {
      const text = "the the the deploy deploy release";
      const topics = extractTopics(text);
      expect(topics).not.toContain("The");
      expect(topics).toContain("Deploy");
    });

    it("capitalizes first letter", () => {
      const text = "testing testing testing";
      const topics = extractTopics(text);
      expect(topics[0]).toBe("Testing");
    });

    it("limits to 7 topics", () => {
      const text = "alpha bravo charlie delta echo foxtrot golf hotel india";
      const topics = extractTopics(text);
      expect(topics.length).toBeLessThanOrEqual(7);
    });

    it("ignores words shorter than 4 chars", () => {
      const text = "the and but deploy release testing";
      const topics = extractTopics(text);
      expect(topics).not.toContain("The");
      expect(topics).not.toContain("And");
    });
  });

  describe("due date validation", () => {
    function validateDueDate(dueDate: string | null, meetingDate: string): string | null {
      if (!dueDate) return null;
      const parsed = new Date(dueDate);
      const anchor = new Date(meetingDate);
      const monthsDiff = (parsed.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (parsed < anchor || monthsDiff > 12) return null;
      return dueDate;
    }

    it("accepts a due date within 12 months of meeting", () => {
      expect(validateDueDate("2026-07-15", "2026-06-28")).toBe("2026-07-15");
    });

    it("rejects a due date before the meeting date", () => {
      expect(validateDueDate("2024-03-15", "2026-06-28")).toBeNull();
    });

    it("rejects a due date more than 12 months after the meeting", () => {
      expect(validateDueDate("2028-07-01", "2026-06-28")).toBeNull();
    });

    it("returns null when dueDate is null", () => {
      expect(validateDueDate(null, "2026-06-28")).toBeNull();
    });

    it("accepts a due date exactly on the meeting date", () => {
      expect(validateDueDate("2026-06-28", "2026-06-28")).toBe("2026-06-28");
    });
  });
});
