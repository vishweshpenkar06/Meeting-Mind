export interface MeetingTemplate {
  name: string;
  displayName: string;
  icon: string;
  description: string;
  aiPromptContext?: string;
  agendaPrompt?: string;
}

export const DEFAULT_TEMPLATES: MeetingTemplate[] = [
  {
    name: "general",
    displayName: "General Meeting",
    icon: "\uD83D\uDCC4",
    description: "Standard meeting with agenda and action items",
    aiPromptContext:
      "This is a general meeting. Produce a balanced analysis covering: what was discussed (key themes), decisions made, and concrete action items with owners and deadlines. Include risks and follow-ups.",
    agendaPrompt:
      "Generate a 4-5 item agenda for a general team meeting. Include: status updates, open discussion items, decisions needed, and action item review.",
  },
  {
    name: "standup",
    displayName: "Daily Standup",
    icon: "\uD83D\uDCCB",
    description: "What did you do yesterday? What will you do today? Any blockers?",
    aiPromptContext:
      "This is a daily standup meeting. The summary MUST follow this exact structure:\n\n## Yesterday\n- What each person completed\n\n## Today\n- What each person will work on\n\n## Blockers\n- Any impediments or blockers\n\nAction items should be micro-tasks due within 24 hours. Each action item must specify WHO is responsible. Keep everything extremely concise.",
    agendaPrompt:
      "Generate a 3-item standup agenda: (1) What did you accomplish yesterday? (2) What will you work on today? (3) Any blockers or impediments?",
  },
  {
    name: "retro",
    displayName: "Sprint Retrospective",
    icon: "\uD83D\uDD04",
    description: "What went well? What could be improved? Action items for next sprint.",
    aiPromptContext:
      "This is a sprint retrospective. The summary MUST follow this exact structure:\n\n## What Went Well\n- Specific successes and wins from this sprint\n\n## What Could Improve\n- Pain points and areas needing change\n\n## Action Items for Next Sprint\n- Concrete process improvements with owners\n\nDecisions should focus on process changes. Action items must be team-level improvements (not individual tasks). Include risks that could affect the next sprint.",
    agendaPrompt:
      "Generate a 4-item retro agenda: (1) Celebrate wins from this sprint, (2) Identify what slowed us down, (3) Propose process improvements, (4) Define action items for next sprint.",
  },
  {
    name: "one-on-one",
    displayName: "1:1 Meeting",
    icon: "\uD83E\uDD1D",
    description: "Personal check-in, feedback, career development topics.",
    aiPromptContext:
      "This is a 1:1 meeting between a manager and report. The summary MUST follow this exact structure:\n\n## Check-in\n- How the person is feeling, any concerns\n\n## Feedback Given\n- Positive feedback and constructive feedback\n\n## Career Development\n- Goals discussed, growth opportunities, skill development\n\n## Support Needed\n- What the manager can provide (resources, mentorship, unblocking)\n\nAction items should focus on personal development goals and follow-ups. Risks should capture any wellbeing or performance concerns.",
    agendaPrompt:
      "Generate a 4-item 1:1 agenda: (1) Personal check-in and mood, (2) Recent accomplishments and feedback, (3) Career goals and growth areas, (4) Support needed from manager.",
  },
  {
    name: "client-call",
    displayName: "Client Call",
    icon: "\uD83D\uDCDE",
    description: "Client discussion, requirements, decisions, next steps.",
    aiPromptContext:
      "This is a client-facing call. The summary MUST follow this exact structure:\n\n## Client Requirements\n- What the client needs, their goals, and constraints\n\n## Decisions Made\n- Agreements reached, approvals given, scope confirmed\n\n## Deliverables & Commitments\n- What we promised to deliver, with deadlines\n\n## Client Feedback\n- What the client liked or wants changed\n\nAction items must specify: (1) what to deliver, (2) the deadline, (3) who owns it. Risks should capture any scope creep, timeline concerns, or client dissatisfaction.",
    agendaPrompt:
      "Generate a 4-item client call agenda: (1) Review current status and progress, (2) Discuss client requirements and feedback, (3) Confirm decisions and approvals, (4) Define next steps and deliverables.",
  },
  {
    name: "brainstorm",
    displayName: "Brainstorm",
    icon: "\uD83D\uDCA1",
    description: "Open discussion, idea generation, creative exploration.",
    aiPromptContext:
      "This is a brainstorm session. The summary MUST follow this exact structure:\n\n## Ideas Generated\n- List ALL ideas mentioned, even half-formed ones\n\n## Top Candidates\n- The 2-3 most promising ideas with rationale\n\n## Themes & Patterns\n- Common threads across ideas\n\n## Next Steps\n- How to evaluate and prototype the top ideas\n\nDecisions should focus on which ideas to pursue. Action items should be about prototyping or researching specific ideas. Risks should capture feasibility concerns.",
    agendaPrompt:
      "Generate a 3-item brainstorm agenda: (1) Define the problem or opportunity, (2) Generate ideas freely (no judgment), (3) Vote on top ideas and assign owners.",
  },
];

export function getTemplate(name?: string): MeetingTemplate | undefined {
  if (!name) return DEFAULT_TEMPLATES[0];
  return DEFAULT_TEMPLATES.find((t) => t.name === name);
}
