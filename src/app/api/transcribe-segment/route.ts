import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "node:crypto";
import { transcribeAudio } from "@/lib/transcription";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const audio = formData.get("audio") as File | null;
    const meetingId = formData.get("meetingId") as string | null;

    if (!audio) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    // Require meetingId to ensure segments are associated
    if (!meetingId) {
      return NextResponse.json({ error: "meetingId is required" }, { status: 400 });
    }

    // Upload segment to storage
    const ext = audio.name.split(".").pop() || "webm";
    const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("meeting-audio")
      .upload(filePath, audio);
    if (uploadError) throw new Error(uploadError.message);

    // Use a signed URL for private buckets
    const { data: signedData, error: signedError } = await supabase.storage
      .from("meeting-audio")
      .createSignedUrl(uploadData.path, 300);
    if (signedError || !signedData?.signedUrl) throw new Error(signedError?.message || "Could not generate signed URL");

    // Download and transcribe with the shared transcription helper
    const audioRes = await fetch(signedData.signedUrl);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);
    const audioBlob = await audioRes.blob();
    const resultText = await transcribeAudio(audioBlob, audioBlob.type || undefined);

    // Save transcript segment
    await supabase.from("transcript_segments").insert({
      meeting_id: meetingId,
      text: resultText || "",
      start_time: 0,
      end_time: 0,
      speaker: null,
    });

    return NextResponse.json({
      text: resultText,
      audioUrl: signedData.signedUrl,
    });
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
