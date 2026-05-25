import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";
import { OpenAI } from "openai";

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

    // Fetch past meetings of the same type
    const { data: recentMeetings } = await supabase
      .from("meetings")
      .select("title, summary, action_items(task_description, is_completed, due_date)")
      .eq("user_id", user.id)
      .eq("meeting_type", templateName || "general")
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

    contextPrompt += `Generate a concise suggested agenda (3-5 items) for a ${template?.displayName || "General"} meeting.`;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: "You are a meeting planner. Generate a suggested agenda as a numbered list. Return ONLY the agenda items, one per line, numbered. Keep each item under 10 words. No extra text." },
        { role: "user", content: contextPrompt },
      ],
      temperature: 0.5,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ items: [] });
    }

    // Parse numbered list
    const items = content
      .split("\n")
      .map((line) => line.replace(/^\d+[\.\)\-]\s*/, "").trim())
      .filter(Boolean);

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Agenda generation error:", err);
    return NextResponse.json({ items: [] });
  }
}
