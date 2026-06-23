import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

function getDefaultAgenda(templateName: string): string[] {
  const agendas: Record<string, string[]> = {
    general: [
      "Review action items from last meeting",
      "Discuss current project status",
      "Address blockers and dependencies",
      "Plan next steps and assignments",
    ],
    standup: [
      "What did you accomplish yesterday?",
      "What will you work on today?",
      "Any blockers or impediments?",
    ],
    retro: [
      "Celebrate wins from this sprint",
      "Identify what slowed us down",
      "Propose process improvements",
      "Define action items for next sprint",
    ],
    "one-on-one": [
      "Personal check-in and mood",
      "Recent accomplishments and feedback",
      "Career goals and growth areas",
      "Support needed from manager",
    ],
    "client-call": [
      "Review current status and progress",
      "Discuss client requirements and feedback",
      "Confirm decisions and approvals",
      "Define next steps and deliverables",
    ],
    brainstorm: [
      "Define the problem or opportunity",
      "Generate ideas freely (no judgment)",
      "Vote on top ideas and assign owners",
    ],
  };
  return agendas[templateName] || agendas.general;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { templateName } = body;

    const template = getTemplate(templateName);
    const agendaPrompt = template?.agendaPrompt;

    const { data: recentMeetings } = await supabase
      .from("meetings")
      .select("title, summary, action_items(task_description, is_completed, due_date)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    let contextPrompt = "";
    if (recentMeetings && recentMeetings.length > 0) {
      const summaries = recentMeetings.map((m) => m.summary).filter(Boolean).join("\n---\n");
      const pendingItems = recentMeetings
        .flatMap((m) => (m.action_items || []))
        .filter((a) => !a.is_completed);

      contextPrompt += "Based on recent meetings of this type:\n";
      if (summaries) {
        contextPrompt += `Recent topics:\n${summaries.slice(0, 1000)}\n\n`;
      }
      if (pendingItems.length > 0) {
        contextPrompt += "Pending action items from past meetings:\n";
        pendingItems.forEach((item) => {
          contextPrompt += `- ${item.task_description}${item.due_date ? ` (due: ${item.due_date})` : ""}\n`;
        });
        contextPrompt += "\n";
      }
    }

    if (agendaPrompt) {
      contextPrompt += agendaPrompt;
    } else {
      contextPrompt += `Generate a concise suggested agenda (3-5 items) for a ${template?.displayName || "General"} meeting.`;
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o";
    const { text } = await generateText({
      model: openai(model),
      system: "You are a meeting planner. Generate a suggested agenda as a numbered list. Return ONLY the agenda items, one per line, numbered. Keep each item under 10 words. No extra text.",
      prompt: contextPrompt,
      temperature: 0.5,
    });

    const content = text?.trim();
    if (!content) {
      return NextResponse.json({ items: getDefaultAgenda(templateName || "general") });
    }

    const items = content
      .split("\n")
      .map((line) => line.replace(/^\d+[\.\)\-]\s*/, "").trim())
      .filter(Boolean);

    return NextResponse.json({ items: items.length > 0 ? items : getDefaultAgenda(templateName || "general") });
  } catch (err) {
    console.error("Agenda generation error:", err);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ items: getDefaultAgenda(body.templateName || "general") });
  }
}
