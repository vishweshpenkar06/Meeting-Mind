import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio, transcribeMediaFile } from "@/lib/transcription";
import { processMeetingWithAI } from "@/lib/ai-providers";
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
        share_token
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

    const formatted = meetings?.map((m: { id: string; title: string; created_at: string; is_public: boolean; share_token: string | null }) => ({
      id: m.id,
      title: m.title || "Untitled Meeting",
      date: m.created_at,
      meetingType: "general",
      isPublic: m.is_public,
      shareToken: m.share_token,
      tasks: 0,
      decisions: 0,
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

    const contentType = request.headers.get("content-type") || "";
    let transcript: string | undefined;
    let title: string | undefined;
    let audioUrl: string | undefined;
    let templateId: string | undefined;
    let templateName: string | undefined;
    let durationSeconds: number | undefined;
    let meetingType: string | undefined;
    let language: string | undefined;
    let uploadedFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const transcriptValue = formData.get("transcript");
      const titleValue = formData.get("title");
      const audioUrlValue = formData.get("audioUrl");
      const templateIdValue = formData.get("templateId");
      const templateNameValue = formData.get("templateName");
      const durationSecondsValue = formData.get("durationSeconds");
      const meetingTypeValue = formData.get("meetingType");
      const languageValue = formData.get("language");
      const fileValue = formData.get("file");

      transcript = typeof transcriptValue === "string" ? transcriptValue : undefined;
      title = typeof titleValue === "string" ? titleValue : undefined;
      audioUrl = typeof audioUrlValue === "string" ? audioUrlValue : undefined;
      templateId = typeof templateIdValue === "string" ? templateIdValue : undefined;
      templateName = typeof templateNameValue === "string" ? templateNameValue : undefined;
      durationSeconds = typeof durationSecondsValue === "string" && durationSecondsValue ? Number(durationSecondsValue) : undefined;
      meetingType = typeof meetingTypeValue === "string" ? meetingTypeValue : undefined;
      language = typeof languageValue === "string" ? languageValue : undefined;
      uploadedFile = fileValue instanceof File ? fileValue : null;
    } else {
      const body = await request.json();
      ({ transcript, title, audioUrl, templateId, templateName, durationSeconds, meetingType, language } = body as {
        transcript?: string;
        title?: string;
        audioUrl?: string;
        templateId?: string;
        templateName?: string;
        durationSeconds?: number;
        meetingType?: string;
        language?: string;
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

    // If a file is uploaded but no transcript exists, transcribe the file directly.
    // If transcription fails (for example, provider limitations), fall back to a minimal transcript
    // so the meeting can still be analyzed into notes instead of failing outright.
    let effectiveTranscript = transcript;
    let transcriptionFailed = false;

    if (uploadedFile && !transcript) {
      console.log(`Transcribing uploaded file: ${uploadedFile.name} (${uploadedFile.type}, ${(uploadedFile.size / 1024 / 1024).toFixed(1)}MB)`);
      try {
        const buffer = Buffer.from(await uploadedFile.arrayBuffer());
        console.log(`File buffer loaded: ${buffer.length} bytes`);
        effectiveTranscript = await transcribeMediaFile(
          buffer,
          uploadedFile.type || "application/octet-stream",
          uploadedFile.name || "meeting-file",
          language
        );
        console.log(`Transcription complete (${effectiveTranscript.length} chars)`);
      } catch (transcriptionError) {
        const errMsg = transcriptionError instanceof Error ? transcriptionError.message : String(transcriptionError);
        console.error("Transcription failed:", errMsg);
        transcriptionFailed = true;
        effectiveTranscript = "";
      }
    } else if (audioUrl && !transcript) {
      console.log(`Transcribing audio from: ${audioUrl}`);
      try {
        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok) {
          return NextResponse.json(
            { error: `Failed to download audio: ${audioRes.status} ${audioRes.statusText}` },
            { status: 502 }
          );
        }
        const audioBlob = await audioRes.blob();
        const fetchedContentType = audioRes.headers.get("content-type") || undefined;

        effectiveTranscript = await transcribeAudio(audioBlob, fetchedContentType, language);
        console.log(`Transcription complete (${effectiveTranscript.length} chars)`);
      } catch (transcriptionError) {
        const errMsg = transcriptionError instanceof Error ? transcriptionError.message : String(transcriptionError);
        console.error("Audio transcription failed:", errMsg);
        transcriptionFailed = true;
        effectiveTranscript = "";
      }
    }

    if (!effectiveTranscript || effectiveTranscript.trim().length < 10) {
      if (transcriptionFailed) {
        return NextResponse.json(
          { error: "Transcription failed. Please check that GROQ_API_KEY is set in .env.local and try again. You can also paste the transcript manually." },
          { status: 422 }
        );
      }
      if (!effectiveTranscript) {
        return NextResponse.json(
          { error: "No transcript could be generated" },
          { status: 500 }
        );
      }
    }

    if (!user) {
      const result = await processMeetingWithAI(effectiveTranscript, templateContext);
      return NextResponse.json(
        {
          demo: true,
          title: result.title,
          result,
          raw_transcript: effectiveTranscript,
        },
        { status: 200 }
      );
    }

    // Create meeting in DB
    const shareToken = crypto.randomUUID();
    const inferredTitle = uploadedFile
      ? uploadedFile.name.replace(/\.[^.]+$/, "").replace(/[._-]+/g, " ").trim()
      : "";
    const defaultTitle = title || inferredTitle || "Processing Meeting...";

    const meetingData: Record<string, unknown> = {
      user_id: user.id,
      title: defaultTitle,
      raw_transcript: effectiveTranscript,
      summary: "",
      share_token: shareToken,
      is_public: false,
      audio_url: audioUrl || null,
    };
    if (templateName) meetingData.template_name = templateName;

    let { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert(meetingData)
      .select()
      .single();

    if (meetingError && meetingError.message.includes("template_name")) {
      delete meetingData.template_name;
      const retry = await supabase
        .from("meetings")
        .insert(meetingData)
        .select()
        .single();
      meeting = retry.data;
      meetingError = retry.error;
    }

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

    // Fetch complete meeting (no joins — tables may not exist)
    const { data: fullMeeting, error: fetchError } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meeting.id)
      .single();

    if (fetchError || !fullMeeting) {
      console.warn("Failed to fetch full meeting, returning basic data:", fetchError?.message);
      return NextResponse.json(meeting, { status: 201 });
    }

    return NextResponse.json(fullMeeting, { status: 201 });
  } catch (err) {
    console.error("Error creating meeting:", err);
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    );
  }
}
