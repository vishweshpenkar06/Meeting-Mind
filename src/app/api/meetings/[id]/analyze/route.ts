import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processMeetingWithAI, diarizeTranscript } from "@/lib/ai-providers";
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
      .select("*")
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

    const result = await processMeetingWithAI(meeting.raw_transcript || "");

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
          result.decisions.map((d) => ({
            meeting_id: id,
            decision_text: typeof d === "string"
              ? d
              : typeof d === "object" && d !== null
                ? String(d.decision || JSON.stringify(d))
                : String(d),
          }))
        );
      }
    } catch (insertError) {
      console.warn("Failed saving action items/decisions:", insertError);
    }

    try {
      const transcript = meeting.raw_transcript || "";
      if (transcript.length > 50) {
        const segments = await diarizeTranscript(transcript);
        if (segments.length > 0) {
          await supabase.from("transcript_segments").delete().eq("meeting_id", id);
          await supabase.from("transcript_segments").insert(
            segments.map((seg) => ({
              meeting_id: id,
              speaker: seg.speaker,
              text: seg.text,
              start_time: null,
              end_time: null,
            }))
          );
        }
      }
    } catch (diarizationError) {
      console.warn("Diarization failed (non-blocking):", diarizationError);
    }

    try {
      await supabase.from("meeting_notes").delete().eq("meeting_id", id);

      if (result.keyTopics && result.keyTopics.length > 0) {
        await supabase.from("meeting_notes").insert({
          meeting_id: id,
          section: "keyTopics",
          content: JSON.stringify(result.keyTopics),
        });
      }
      if (result.risks && result.risks.length > 0) {
        await supabase.from("meeting_notes").insert({
          meeting_id: id,
          section: "risks",
          content: JSON.stringify(result.risks),
        });
      }
      if (result.followUps && result.followUps.length > 0) {
        await supabase.from("meeting_notes").insert({
          meeting_id: id,
          section: "followUps",
          content: JSON.stringify(result.followUps),
        });
      }
    } catch (notesError) {
      console.warn("Failed saving notes (table may not exist):", notesError);
    }

    try {
      const searchContent = [
        result.title,
        result.summary,
        ...result.decisions.map((d) => typeof d === "string" ? d : d.decision),
        ...result.actionItems.map((item) => `${item.task} (Owner: ${item.owner})`),
        ...(result.keyTopics || []),
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
