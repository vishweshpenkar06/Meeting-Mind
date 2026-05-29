import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processMeetingWithAI } from "@/lib/ai-providers";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: meeting, error: fetchError } = await supabase
      .from("meetings")
      .select("*, meeting_templates(ai_prompt_context)")
      .eq("id", id)
      .single();

    if (fetchError || !meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (meeting.summary) {
      return NextResponse.json({ ok: true, alreadyAnalyzed: true });
    }

    const templateContext = meeting.meeting_templates?.ai_prompt_context;
    const result = await processMeetingWithAI(meeting.raw_transcript || "", templateContext);

    const { error: updateError } = await supabase
      .from("meetings")
      .update({
        title: result.title || meeting.title,
        summary: result.summary,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    try {
      await supabase.from("action_items").delete().eq("meeting_id", id);
      await supabase.from("key_decisions").delete().eq("meeting_id", id);

      if (result.actionItems.length > 0) {
        await supabase.from("action_items").insert(
          result.actionItems.map((item) => ({
            meeting_id: id,
            owner_name: item.owner,
            task_description: item.task,
            due_date: item.dueDate || null,
          }))
        );
      }

      if (result.decisions.length > 0) {
        await supabase.from("key_decisions").insert(
          result.decisions.map((decision) => ({
            meeting_id: id,
            decision_text: decision,
          }))
        );
      }
    } catch (insertError) {
      console.warn("Failed saving note details:", insertError);
    }

    try {
      const searchContent = [
        result.title,
        result.summary,
        ...result.decisions,
        ...result.actionItems.map((item) => `${item.task} (Owner: ${item.owner})`),
      ].join("\n");

      const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: searchContent,
      });

      await supabase
        .from("meetings")
        .update({ embedding })
        .eq("id", id)
        .eq("user_id", user.id);
    } catch (embedError) {
      console.warn("Embedding skipped:", embedError);
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Analyze meeting error:", error);
    return NextResponse.json({ error: "Failed to analyze meeting" }, { status: 500 });
  }
}