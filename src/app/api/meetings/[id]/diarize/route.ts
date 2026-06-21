import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { diarizeTranscript } from "@/lib/ai-providers";

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
      .select("raw_transcript, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: existing } = await supabase
      .from("transcript_segments")
      .select("id")
      .eq("meeting_id", id)
      .limit(1);

    if (existing && existing.length > 0) {
      const { data: segments } = await supabase
        .from("transcript_segments")
        .select("*")
        .eq("meeting_id", id)
        .order("created_at", { ascending: true });
      return NextResponse.json({ segments: segments || [] });
    }

    const transcript = meeting.raw_transcript || "";
    if (transcript.length < 50) {
      return NextResponse.json({ segments: [] });
    }

    const diarizedSegments = await diarizeTranscript(transcript);

    if (diarizedSegments.length > 0) {
      await supabase.from("transcript_segments").insert(
        diarizedSegments.map((seg) => ({
          meeting_id: id,
          speaker: seg.speaker,
          text: seg.text,
          start_time: null,
          end_time: null,
        }))
      );
    }

    const { data: savedSegments } = await supabase
      .from("transcript_segments")
      .select("*")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ segments: savedSegments || [] });
  } catch (error) {
    console.error("Diarization error:", error);
    return NextResponse.json({ error: "Failed to diarize transcript" }, { status: 500 });
  }
}
