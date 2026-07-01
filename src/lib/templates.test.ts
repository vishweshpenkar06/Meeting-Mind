import { describe, it, expect } from "vitest";
import { getTemplate, DEFAULT_TEMPLATES } from "./templates";

describe("templates", () => {
  it("returns general template when no name provided", () => {
    const template = getTemplate();
    expect(template).toBeDefined();
    expect(template!.name).toBe("general");
  });

  it("returns general template when undefined", () => {
    const template = getTemplate(undefined);
    expect(template!.name).toBe("general");
  });

  it("returns correct template by name", () => {
    const template = getTemplate("standup");
    expect(template).toBeDefined();
    expect(template!.name).toBe("standup");
    expect(template!.displayName).toBe("Daily Standup");
    expect(template!.aiPromptContext).toContain("STANDUP");
  });

  it("returns undefined for unknown template name", () => {
    const template = getTemplate("nonexistent");
    expect(template).toBeUndefined();
  });

  it("has all required default templates", () => {
    const names = DEFAULT_TEMPLATES.map((t) => t.name);
    expect(names).toContain("general");
    expect(names).toContain("standup");
    expect(names).toContain("retro");
    expect(names).toContain("one-on-one");
    expect(names).toContain("client-call");
    expect(names).toContain("brainstorm");
  });

  it("each template has required fields", () => {
    for (const template of DEFAULT_TEMPLATES) {
      expect(template.name).toBeTruthy();
      expect(template.displayName).toBeTruthy();
      expect(template.icon).toBeTruthy();
      expect(template.description).toBeTruthy();
    }
  });

  it("each template has aiPromptContext", () => {
    for (const template of DEFAULT_TEMPLATES) {
      expect(template.aiPromptContext).toBeTruthy();
    }
  });

  it("each template has sampleAgenda", () => {
    for (const template of DEFAULT_TEMPLATES) {
      expect(template.sampleAgenda).toBeTruthy();
      expect(template.sampleAgenda!.length).toBeGreaterThan(0);
    }
  });

  it("each template has sampleBriefing", () => {
    for (const template of DEFAULT_TEMPLATES) {
      expect(template.sampleBriefing).toBeTruthy();
      expect(template.sampleBriefing!.contextSummary).toBeTruthy();
    }
  });
});
