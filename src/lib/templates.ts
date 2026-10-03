export interface MeetingTemplate {
  name: string;
  displayName: string;
  icon: string;
  description: string;
  aiPromptContext?: string;
  agendaPrompt?: string;
  sampleAgenda?: string[];
  sampleBriefing?: {
    contextSummary: string;
    pendingItems: string[];
    suggestedTopics: string[];
    risks: string[];
  };
}

export const DEFAULT_TEMPLATES: MeetingTemplate[] = [
  {
    name: "general",
    displayName: "General Meeting",
    icon: "\uD83D\uDCC4",
    description: "Standard meeting with agenda and action items",
    aiPromptContext:
      "This is a GENERAL meeting. You MUST produce output in this EXACT format:\n\nSummary sections:\n## What Was Discussed\n- bullet point per topic\n\n## Key Decisions\n- bullet point per decision\n\n## Action Items\n- [Owner] task description (due: date)\n\n## Risks & Follow-ups\n- bullet point\n\nEvery line must be a bullet point. Never write paragraphs. Keep each bullet under 25 words.",
    sampleAgenda: [
      "Review action items from last meeting",
      "Discuss current project status",
      "Address blockers and dependencies",
      "Plan next steps and assignments",
    ],
    sampleBriefing: {
      contextSummary: "Select a meeting type to generate a pre-meeting briefing with context from your past meetings.",
      pendingItems: [],
      suggestedTopics: ["Review agenda items", "Discuss blockers", "Plan next steps"],
      risks: [],
    },
  },
  {
    name: "standup",
    displayName: "Daily Standup",
    icon: "\uD83D\uDCCB",
    description: "What did you do yesterday? What will you do today? Any blockers?",
    aiPromptContext:
      "This is a DAILY STANDUP meeting. You MUST produce output in this EXACT format:\n\nSummary sections:\n## Yesterday\n- [Person Name] completed task description\n- [Person Name] completed task description\n\n## Today\n- [Person Name] will work on task description\n- [Person Name] will work on task description\n\n## Blockers\n- [Person Name] blocked by reason\n- No blockers reported\n\nRULES:\n- Each line MUST start with a person's name in [brackets]\n- NEVER write paragraphs, only bullet points\n- Tasks must be specific and actionable\n- If someone said 'nothing' or 'no blockers', note it explicitly\n- Keep each bullet under 15 words",
    sampleAgenda: [
      "[Alice] What did you accomplish yesterday?",
      "[Bob] What will you work on today?",
      "[Carol] Any blockers or impediments?",
    ],
    sampleBriefing: {
      contextSummary: "Standup context from recent daily syncs.",
      pendingItems: ["Review yesterday's commitments", "Check sprint progress"],
      suggestedTopics: ["Yesterday's accomplishments", "Today's priorities", "Current blockers"],
      risks: ["Unreported blockers may delay sprint goals"],
    },
  },
  {
    name: "retro",
    displayName: "Sprint Retrospective",
    icon: "\uD83D\uDD04",
    description: "What went well? What could be improved? Action items for next sprint.",
    aiPromptContext:
      "This is a SPRINT RETROSPECTIVE. You MUST produce output in this EXACT format:\n\nSummary sections:\n## What Went Well \u2705\n- Specific success with measurable outcome\n- Team win or improvement\n\n## What Could Improve \u26A0\uFE0F\n- Pain point with impact description\n- Process gap that caused issues\n\n## Action Items for Next Sprint \uD83D\uDCAA\n- [Owner] specific improvement to implement\n- [Owner] process change to try\n\nRULES:\n- Focus on TEAM processes, not individual performance\n- Each action must have a named owner\n- Risks should identify process failures\n- Never write paragraphs, only bullet points\n- Keep each bullet under 25 words",
    sampleAgenda: [
      "Celebrate wins from this sprint",
      "Identify what slowed us down",
      "Propose process improvements",
      "Define action items for next sprint",
    ],
    sampleBriefing: {
      contextSummary: "Review recent sprint outcomes to prepare for retrospective discussion.",
      pendingItems: ["Gather team feedback on last sprint", "Review velocity trends"],
      suggestedTopics: ["Sprint velocity review", "Process bottlenecks", "Team morale check"],
      risks: ["Recurring issues may indicate systemic problems"],
    },
  },
  {
    name: "one-on-one",
    displayName: "1:1 Meeting",
    icon: "\uD83E\uDD1D",
    description: "Personal check-in, feedback, career development topics.",
    aiPromptContext:
      "This is a 1:1 MEETING between manager and report. You MUST produce output in this EXACT format:\n\nSummary sections:\n## Check-in \uD83D\uDC4B\n- How the person is feeling\n- Any concerns or challenges mentioned\n\n## Feedback Given \uD83C\uDF1F\n- Positive feedback: what was praised\n- Growth feedback: areas for improvement\n\n## Career Development \uD83D\uDE80\n- Goals discussed\n- Skills to develop\n- Opportunities mentioned\n\n## Support Needed \uD83D\uDD17\n- What manager can provide\n- Resources or unblocking required\n\nRULES:\n- Be empathetic and personal\n- Focus on the individual, not the team\n- Action items should be growth-oriented\n- Risks should capture wellbeing or performance concerns\n- Never write paragraphs, only bullet points",
    sampleAgenda: [
      "Personal check-in and mood",
      "Recent accomplishments and feedback",
      "Career goals and growth areas",
      "Support needed from manager",
    ],
    sampleBriefing: {
      contextSummary: "Prepare for a supportive, growth-focused conversation.",
      pendingItems: ["Review last 1:1 action items", "Check on career goal progress"],
      suggestedTopics: ["Well-being check-in", "Skill development", "Project interests"],
      risks: ["Unaddressed concerns may affect retention"],
    },
  },
  {
    name: "client-call",
    displayName: "Client Call",
    icon: "\uD83D\uDCDE",
    description: "Client discussion, requirements, decisions, next steps.",
    aiPromptContext:
      "This is a CLIENT CALL. You MUST produce output in this EXACT format:\n\nSummary sections:\n## Client Requirements \uD83D\uDCCB\n- What the client needs (their words)\n- Goals and success criteria\n- Constraints or limitations\n\n## Decisions Made \u2705\n- Agreements reached\n- Approvals given\n- Scope confirmed\n\n## Our Commitments \uD83D\uDCE6\n- What we promised to deliver\n- Deadlines committed to\n- Resources allocated\n\n## Client Feedback \uD83D\uDCAC\n- What client liked\n- What client wants changed\n- Open concerns\n\nRULES:\n- Use exact client language where possible\n- Track every commitment with deadline\n- Risks = scope creep, timeline concerns, dissatisfaction\n- Action items must specify: WHAT to deliver, WHEN, WHO owns it\n- Never write paragraphs, only bullet points",
    sampleAgenda: [
      "Review current status and progress",
      "Discuss client requirements and feedback",
      "Confirm decisions and approvals",
      "Define next steps and deliverables",
    ],
    sampleBriefing: {
      contextSummary: "Prepare for client-facing discussion with focus on deliverables and commitments.",
      pendingItems: ["Review open deliverables", "Check pending client approvals"],
      suggestedTopics: ["Project status update", "Client feedback review", "Timeline confirmation"],
      risks: ["Scope creep may affect deadline", "Client expectations may need realignment"],
    },
  },
  {
    name: "brainstorm",
    displayName: "Brainstorm",
    icon: "\uD83D\uDCA1",
    description: "Open discussion, idea generation, creative exploration.",
    aiPromptContext:
      "This is a BRAINSTORM session. You MUST produce output in this EXACT format:\n\nSummary sections:\n## Ideas Generated \uD83D\uDCA1\n- Idea 1: brief description\n- Idea 2: brief description\n- Idea 3: brief description\n(Include ALL ideas, even half-formed ones)\n\n## Top Candidates \uD83C\uDFC6\n- Winner: description + why it's promising\n- Runner-up: description + potential\n\n## Themes & Patterns \uD83D\uDD17\n- Common thread 1\n- Common thread 2\n\n## Next Steps \uD83D\uDE80\n- How to evaluate top ideas\n- Who will prototype what\n\nRULES:\n- Capture EVERY idea mentioned, quantity matters\n- Separate ideation from evaluation\n- Decisions = which ideas to pursue\n- Action items = prototyping or researching specific ideas\n- Risks = feasibility concerns, resource constraints\n- Never write paragraphs, only bullet points",
    sampleAgenda: [
      "Define the problem or opportunity",
      "Generate ideas freely (no judgment)",
      "Vote on top ideas and assign owners",
    ],
    sampleBriefing: {
      contextSummary: "Prepare for creative ideation session focused on generating diverse solutions.",
      pendingItems: ["Review previous brainstorm outcomes", "Gather research on topic"],
      suggestedTopics: ["Problem framing", "Competitive analysis", "User needs exploration"],
      risks: ["Groupthink may limit idea diversity"],
    },
  },
];

export function getTemplate(name?: string): MeetingTemplate | undefined {
  if (!name) return DEFAULT_TEMPLATES[0];
  return DEFAULT_TEMPLATES.find((t) => t.name === name);
}

/**
 * Prompt context for a template name. Custom templates live in the database and
 * are resolved by the caller (the built-in map has no entry for them), so this
 * returns undefined rather than falling back — falling back would silently
 * analyse a custom-template meeting with the general prompt.
 */
export function builtInPromptContext(name?: string | null): string | undefined {
  if (!name) return undefined;
  return DEFAULT_TEMPLATES.find((t) => t.name === name)?.aiPromptContext;
}

export interface BriefingResult {
  contextSummary: string;
  pendingItems: string[];
  suggestedTopics: string[];
  risks: string[];
}

export function getSampleAgenda(name: string): string[] {
  const template = DEFAULT_TEMPLATES.find((t) => t.name === name);
  return template?.sampleAgenda || DEFAULT_TEMPLATES[0].sampleAgenda || [];
}

export function getSampleBriefing(name: string): BriefingResult {
  const template = DEFAULT_TEMPLATES.find((t) => t.name === name);
  return template?.sampleBriefing || DEFAULT_TEMPLATES[0].sampleBriefing!;
}
