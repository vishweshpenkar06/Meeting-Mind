export interface MeetingTemplate {
  name: string;
  displayName: string;
  icon: string;
  description: string;
  aiPromptContext?: string;
}

export const DEFAULT_TEMPLATES: MeetingTemplate[] = [
  {
    name: "general",
    displayName: "General Meeting",
    icon: "\uD83D\uDCC4",
    description: "Standard meeting with agenda and action items",
  },
  {
    name: "standup",
    displayName: "Daily Standup",
    icon: "\uD83D\uDCCB",
    description: "What did you do yesterday? What will you do today? Any blockers?",
    aiPromptContext:
      "This is a daily standup meeting. Focus on: what was completed yesterday, what will be done today, and any blockers or impediments. Keep action items short and specific to the next 24 hours.",
  },
  {
    name: "retro",
    displayName: "Sprint Retrospective",
    icon: "\uD83D\uDD04",
    description: "What went well? What could be improved? Action items for next sprint.",
    aiPromptContext:
      "This is a sprint retrospective meeting. Structure: What went well, what could be improved, action items for next sprint. Focus on team process improvements and actionable feedback.",
  },
  {
    name: "one-on-one",
    displayName: "1:1 Meeting",
    icon: "\uD83E\uDD1D",
    description: "Personal check-in, feedback, career development topics.",
    aiPromptContext:
      "This is a one-on-one meeting. Focus on personal development, feedback, career goals, and well-being. Action items should include follow-ups on personal goals and support needed.",
  },
  {
    name: "client-call",
    displayName: "Client Call",
    icon: "\uD83D\uDCDE",
    description: "Client discussion, requirements, decisions, next steps.",
    aiPromptContext:
      "This is a client call. Focus on requirements gathering, client feedback, decisions made, and next steps. Capture any commitments or deliverables promised to the client.",
  },
  {
    name: "brainstorm",
    displayName: "Brainstorm",
    icon: "\uD83D\uDCA1",
    description: "Open discussion, idea generation, creative exploration.",
    aiPromptContext:
      "This is a brainstorm session. Focus on capturing all ideas, themes that emerge, and prioritized concepts. Separate divergent thinking from convergent thinking.",
  },
];

export function getTemplate(name?: string): MeetingTemplate | undefined {
  if (!name) return DEFAULT_TEMPLATES[0];
  return DEFAULT_TEMPLATES.find((t) => t.name === name);
}
