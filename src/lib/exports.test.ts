import { describe, it, expect } from "vitest";
import { copyShareFormat, type Meeting } from "./exports";

function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: "test-id",
    title: "Test Meeting",
    summary: "Test summary",
    created_at: "2025-01-15T10:00:00Z",
    action_items: [],
    key_decisions: [],
    ...overrides,
  };
}

describe("exports", () => {
  describe("copyShareFormat", () => {
    it("includes meeting title", () => {
      const meeting = makeMeeting({ title: "Sprint Planning" });
      const result = copyShareFormat(meeting);
      expect(result).toContain("Sprint Planning");
    });

    it("includes date", () => {
      const meeting = makeMeeting({ created_at: "2025-01-15T10:00:00Z" });
      const result = copyShareFormat(meeting);
      expect(result).toContain("January");
      expect(result).toContain("2025");
    });

    it("includes summary when present", () => {
      const meeting = makeMeeting({ summary: "We discussed Q1 goals" });
      const result = copyShareFormat(meeting);
      expect(result).toContain("We discussed Q1 goals");
    });

    it("includes action items with owner", () => {
      const meeting = makeMeeting({
        action_items: [
          {
            id: "1",
            owner_name: "Alice",
            task_description: "Review PR #42",
            due_date: "2025-01-20",
            is_completed: false,
          },
        ],
      });
      const result = copyShareFormat(meeting);
      expect(result).toContain("Alice");
      expect(result).toContain("Review PR #42");
    });

    it("marks completed items with checkmark", () => {
      const meeting = makeMeeting({
        action_items: [
          {
            id: "1",
            owner_name: "Bob",
            task_description: "Deploy v2",
            due_date: null,
            is_completed: true,
          },
        ],
      });
      const result = copyShareFormat(meeting);
      expect(result).toContain("\u2705");
    });

    it("marks incomplete items with empty box", () => {
      const meeting = makeMeeting({
        action_items: [
          {
            id: "1",
            owner_name: "Bob",
            task_description: "Deploy v2",
            due_date: null,
            is_completed: false,
          },
        ],
      });
      const result = copyShareFormat(meeting);
      expect(result).toContain("\u2B1C");
    });

    it("includes key decisions", () => {
      const meeting = makeMeeting({
        key_decisions: [
          { id: "1", decision_text: "Use PostgreSQL over MongoDB" },
        ],
      });
      const result = copyShareFormat(meeting);
      expect(result).toContain("Key Decisions");
      expect(result).toContain("Use PostgreSQL over MongoDB");
    });

    it("handles decision_text as object", () => {
      const meeting = makeMeeting({
        key_decisions: [
          {
            id: "1",
            decision_text: { decision: "Switch to TypeScript" },
          },
        ],
      });
      const result = copyShareFormat(meeting);
      expect(result).toContain("Switch to TypeScript");
    });

    it("handles empty meeting", () => {
      const meeting = makeMeeting({
        title: "",
        summary: "",
        action_items: [],
        key_decisions: [],
      });
      const result = copyShareFormat(meeting);
      expect(result).toContain("Untitled Meeting");
    });

    it("shows correct task count", () => {
      const meeting = makeMeeting({
        action_items: [
          { id: "1", owner_name: "A", task_description: "t1", due_date: null, is_completed: true },
          { id: "2", owner_name: "B", task_description: "t2", due_date: null, is_completed: false },
          { id: "3", owner_name: "C", task_description: "t3", due_date: null, is_completed: true },
        ],
      });
      const result = copyShareFormat(meeting);
      expect(result).toContain("2/3 tasks done");
    });
  });
});
