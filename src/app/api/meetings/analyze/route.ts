import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processMeetingWithAI } from "@/lib/ai-providers";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { transcript, templateContext } = body as { transcript: string; templateContext?: string };

    if (!transcript || transcript.length < 100) {
      return NextResponse.json(
        { error: "Transcript too short (minimum 100 characters)" },
        { status: 400 }
      );
    }

    const result = await processMeetingWithAI(transcript, templateContext);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Error analyzing meeting:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to analyze meeting" },
      { status: 500 }
    );
  }
}
