import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "node:crypto";
import { transcribeAudio } from "@/lib/transcription";
import { limitFor } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  let uploadedPath: string | null = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Live recording fires this every 5 seconds; this is the highest-volume,
    // highest-cost endpoint in the app
    const budget = limitFor(user.id, "transcribe");
    if (!budget.ok) {
      return NextResponse.json(
        { error: "Transcription limit reached. Pause recording and try again later." },
        { status: 429, headers: { "Retry-After": String(budget.retryAfter) } }
      );
    }

    if (!process.env.GROQ_API_KEY && !process.env.NVIDIA_API_KEY) {
      return NextResponse.json(
        { error: "Transcription service not configured. Add GROQ_API_KEY or NVIDIA_API_KEY to your environment." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    const meetingId = formData.get("meetingId");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    if (typeof meetingId !== "string" || !meetingId) {
      return NextResponse.json({ error: "meetingId is required" }, { status: 400 });
    }

    const { data: meeting } = await supabase
      .from("meetings")
      .select("id")
      .eq("id", meetingId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > 30 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio chunk too large" }, { status: 413 });
    }

    console.log(`Transcribing segment: ${audio.name}, size: ${audio.size} bytes, type: ${audio.type}`);

    const ext = (audio.name.split(".").pop() || "webm").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "webm";
    const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("meeting-audio")
      .upload(filePath, audio);
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
    uploadedPath = uploadData.path;

    const { data: signedData, error: signedError } = await supabase.storage
      .from("meeting-audio")
      .createSignedUrl(uploadData.path, 300);
    if (signedError || !signedData?.signedUrl) throw new Error(signedError?.message || "Could not generate signed URL");

    const audioRes = await fetch(signedData.signedUrl);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);
    const audioBlob = await audioRes.blob();
    const resultText = await transcribeAudio(audioBlob, audio.type || undefined);

    const { error: insertError } = await supabase.from("transcript_segments").insert({
      meeting_id: meetingId,
      text: resultText || "",
      start_time: 0,
      end_time: 0,
      speaker: null,
    });
    if (insertError) throw new Error(`Could not save transcript segment: ${insertError.message}`);

    if (!resultText || resultText.trim().length === 0) {
      console.warn("Transcription returned empty text for segment");
    }

    return NextResponse.json({ text: resultText });
  } catch (err) {
    console.error("Transcription error:", err);
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Chunks are only a transport to the transcription API; never accumulate them
    if (uploadedPath) {
      await supabase.storage.from("meeting-audio").remove([uploadedPath]).catch(() => {});
    }
  }
}
