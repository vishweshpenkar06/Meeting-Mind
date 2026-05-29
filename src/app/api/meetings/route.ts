import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/transcription";
import crypto from "crypto";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { getTemplate } from "@/lib/templates";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let queryBuilder = supabase
      .from("meetings")
      .select(
        `
        id,
        title,
        created_at,
        summary,
        is_public,
        share_token,
        action_items(count),
        key_decisions(count)
      `
      )
      .eq("user_id", user.id);

    let matchedOrder: string[] = [];

    if (query) {
      try {
        const { embedding } = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: query,
        });

        // Use the RPC match function
        const { data: matchedMeetings, error: matchError } = await supabase.rpc("match_meetings", {
          query_embedding: embedding,
          match_threshold: 0.3, // Return reasonably similar results
          match_count: 20,
          p_user_id: user.id
        });

        if (matchError) {
          console.error("Match error:", matchError);
          // Fallback to text search if RPC fails (e.g. user hasn't run SQL yet)
          queryBuilder = queryBuilder.textSearch("search_vector", query, {
            type: "websearch",
            config: "english",
          });
        } else if (matchedMeetings && matchedMeetings.length > 0) {
          matchedOrder = matchedMeetings.map((m: { id: string }) => m.id);
          queryBuilder = queryBuilder.in("id", matchedOrder);
        } else {
          // No matches found, force empty result
          queryBuilder = queryBuilder.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      } catch (embedError) {
        console.error("Embedding error:", embedError);
        queryBuilder = queryBuilder.textSearch("search_vector", query, {
          type: "websearch",
          config: "english",
        });
      }
    } else {
      queryBuilder = queryBuilder.order("created_at", { ascending: false });
    }

    // Also fetch overdue reminder count
    const { data: overdueItems } = await supabase
      .from("action_items")
      .select("id")
      .eq("is_completed", false)
      .lt("due_date", new Date().toISOString().split("T")[0]);

    const { data: meetings, error } = await queryBuilder;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (matchedOrder.length > 0 && meetings) {
      meetings.sort((a: { id: string }, b: { id: string }) => matchedOrder.indexOf(a.id) - matchedOrder.indexOf(b.id));
    }

    const formatted = meetings?.map((m: { id: string; title: string; created_at: string; is_public: boolean; share_token: string | null; action_items: { count: number }[]; key_decisions: { count: number }[] }) => ({
      id: m.id,
      title: m.title || "Untitled Meeting",
      date: m.created_at,
      meetingType: "general",
      isPublic: m.is_public,
      shareToken: m.share_token,
      tasks: m.action_items?.[0]?.count ?? 0,
      decisions: m.key_decisions?.[0]?.count ?? 0,
    }));

    return NextResponse.json({
      meetings: formatted || [],
      overdueCount: overdueItems?.length ?? 0,
    });
  } catch (err) {
    console.error("Error fetching meetings:", err);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    let transcript: string | undefined;
    let title: string | undefined;
    let audioUrl: string | undefined;
    let templateId: string | undefined;
    let templateName: string | undefined;
    let durationSeconds: number | undefined;
    let uploadedFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const transcriptValue = formData.get("transcript");
      const titleValue = formData.get("title");
      const audioUrlValue = formData.get("audioUrl");
      const templateIdValue = formData.get("templateId");
      const templateNameValue = formData.get("templateName");
      const durationSecondsValue = formData.get("durationSeconds");
      const fileValue = formData.get("file");

      transcript = typeof transcriptValue === "string" ? transcriptValue : undefined;
      title = typeof titleValue === "string" ? titleValue : undefined;
      audioUrl = typeof audioUrlValue === "string" ? audioUrlValue : undefined;
      templateId = typeof templateIdValue === "string" ? templateIdValue : undefined;
      templateName = typeof templateNameValue === "string" ? templateNameValue : undefined;
      durationSeconds = typeof durationSecondsValue === "string" && durationSecondsValue ? Number(durationSecondsValue) : undefined;
      uploadedFile = fileValue instanceof File ? fileValue : null;
    } else {
      const body = await request.json();
      ({ transcript, title, audioUrl, templateId, templateName, durationSeconds } = body as {
        transcript?: string;
        title?: string;
        audioUrl?: string;
        templateId?: string;
        templateName?: string;
        durationSeconds?: number;
      });
    }

    if (!transcript && !audioUrl && !uploadedFile) {
      return NextResponse.json(
        { error: "Either transcript, audioUrl, or file is required" },
        { status: 400 }
      );
    }

    // Fetch template context from built-in defaults only
    const templateContext = getTemplate(templateName)?.aiPromptContext;

    // If a file is uploaded but no transcript exists, transcribe the file directly
    let effectiveTranscript = transcript;
    if (uploadedFile && !transcript) {
      console.log(`Transcribing uploaded file: ${uploadedFile.name}`);
      effectiveTranscript = await transcribeAudio(uploadedFile, uploadedFile.type || undefined);
      console.log(`Transcription complete (${effectiveTranscript.length} chars)`);
    } else if (audioUrl && !transcript) {
      console.log(`Transcribing audio from: ${audioUrl}`);
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) {
        return NextResponse.json(
          { error: `Failed to download audio: ${audioRes.status} ${audioRes.statusText}` },
          { status: 502 }
        );
      }
      const audioBlob = await audioRes.blob();

      // Extract MIME type from Content-Type header if available
      const fetchedContentType = audioRes.headers.get("content-type") || undefined;

      effectiveTranscript = await transcribeAudio(audioBlob, fetchedContentType);
      console.log(`Transcription complete (${effectiveTranscript.length} chars)`);
    }

    if (!effectiveTranscript) {
      return NextResponse.json(
        { error: "No transcript could be generated" },
        { status: 500 }
      );
    }

    // Create meeting in DB
    const shareToken = crypto.randomUUID();
    const inferredTitle = uploadedFile
      ? uploadedFile.name.replace(/\.[^.]+$/, "").replace(/[._-]+/g, " ").trim()
      : "";
    const defaultTitle = title || inferredTitle || "Processing Meeting...";

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert({
        user_id: user.id,
        title: defaultTitle,
        raw_transcript: effectiveTranscript,
        summary: "",
        share_token: shareToken,
        is_public: false,
        audio_url: audioUrl || null,
      })
      .select()
      .single();

    if (meetingError) {
      return NextResponse.json({ error: meetingError.message }, { status: 500 });
    }

    // Compute basic quality metrics (pre-analysis)
    const wordCount = effectiveTranscript.split(/\s+/).length;
    
    try {
      await supabase.from("meeting_quality_metrics").insert({
        meeting_id: meeting.id,
        sentiment_pct: 0,
        engagement_pct: 0,
        monologue_pct: 0,
        action_item_completion_pct: 0,
        participant_count: Math.min(10, Math.max(1, wordCount / 200)),
      });
    } catch (qualityErr) {
      console.warn("Quality metrics computation failed:", qualityErr);
    }

    // Fetch complete meeting
    const { data: fullMeeting } = await supabase
      .from("meetings")
      .select(
        `
        *,
        action_items(*),
        key_decisions(*)
      `
      )
      .eq("id", meeting.id)
      .single();

    return NextResponse.json(fullMeeting, { status: 201 });
  } catch (err) {
    console.error("Error creating meeting:", err);
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    );
  }
}
