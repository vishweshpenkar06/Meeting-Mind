import { NextResponse } from "next/server";
import { processMeetingWithAI } from "@/lib/ai-providers";

export async function POST(request: Request) {
  try {
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
