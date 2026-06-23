import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";
import { generatePreMeetingBriefing } from "@/lib/ai-providers";

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

    const { data: recentMeetings } = await supabase
      .from("meetings")
      .select("title, summary, action_items(task_description, is_completed, due_date)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const briefing = await generatePreMeetingBriefing(
      template?.displayName || templateName || "General",
      (recentMeetings || []) as Array<{
        title: string;
        summary: string;
        action_items?: Array<{ task_description: string; is_completed: boolean; due_date: string | null }>;
      }>,
    );

    return NextResponse.json(briefing);
  } catch (err) {
    console.error("Briefing generation error:", err);
    return NextResponse.json(
      { contextSummary: "No recent meeting context available.", pendingItems: [], suggestedTopics: ["Review agenda items"], risks: [] },
    );
  }
}
