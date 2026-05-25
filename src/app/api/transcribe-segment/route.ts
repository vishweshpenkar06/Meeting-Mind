import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "node:crypto";

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

    // Upload segment to storage
    const ext = audio.name.split(".").pop() || "webm";
    const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("meeting-audio")
      .upload(filePath, audio);
    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage.from("meeting-audio").getPublicUrl(uploadData.path);

    // Download and transcribe with Whisper
    const audioRes = await fetch(publicUrl);
    const audioBlob = await audioRes.blob();
    const audioFile = new File([audioBlob], `segment.${ext}`, { type: audioBlob.type });

    const openai = new (await import("openai")).OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const result = await openai.audio.transcriptions.create({
      file: audioFile,
      model: process.env.OPENAI_MODEL?.includes("whisper") ? process.env.OPENAI_MODEL : "whisper-1",
    });

    // Save transcript segment
    if (meetingId) {
      await supabase.from("transcript_segments").insert({
        meeting_id: meetingId,
        text: result.text || "",
        start_time: 0,
        end_time: 0,
        speaker: null,
      });
    }

    return NextResponse.json({
      text: result.text,
      audioUrl: publicUrl,
    });
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
