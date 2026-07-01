import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio, transcribeMediaFile } from "@/lib/transcription";
import { processMeetingWithAI } from "@/lib/ai-providers";
import crypto from "crypto";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { getTemplate } from "@/lib/templates";
import { Readable } from "stream";

async function parseMultipartBody(request: Request): Promise<{ fields: Record<string, string>; file: File | null }> {
  const contentType = request.headers.get("content-type") || "";
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) throw new Error("No multipart boundary found");

  const boundary = boundaryMatch[1];
  const nodeStream = Readable.fromWeb(request.body as import("stream/web").ReadableStream);
  const chunks: Buffer[] = [];
  for await (const chunk of nodeStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);

  const boundaryBuf = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
  let start = body.indexOf(boundaryBuf) + boundaryBuf.length + 2;

  while (start < body.length) {
    const nextBoundary = body.indexOf(boundaryBuf, start);
    if (nextBoundary === -1) break;
    parts.push(body.subarray(start, nextBoundary - 2));
    start = nextBoundary + boundaryBuf.length + 2;
  }

  const fields: Record<string, string> = {};
  let file: File | null = null;

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headerStr = part.subarray(0, headerEnd).toString("utf-8");
    const data = part.subarray(headerEnd + 4);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const mimeMatch = headerStr.match(/Content-Type:\s*(.+)/i);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    if (filenameMatch) {
      file = new File([new Uint8Array(data)], filenameMatch[1], {
        type: mimeMatch ? mimeMatch[1].trim() : "application/octet-stream",
      });
    } else {
      fields[name] = data.toString("utf-8").trim();
    }
  }

  return { fields, file };
}

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
        template_name
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

    const { data: userMeetingIds } = await supabase
      .from("meetings")
      .select("id")
      .eq("user_id", user.id);

    const meetingIds = userMeetingIds?.map((m: { id: string }) => m.id) ?? [];

    let overdueItems: { id: string; task_description: string; owner_name: string; meeting_id: string }[] | null = null;
    if (meetingIds.length > 0) {
      const result = await supabase
        .from("action_items")
        .select("id, task_description, owner_name, meeting_id")
        .eq("is_completed", false)
        .lt("due_date", new Date().toISOString().split("T")[0])
        .in("meeting_id", meetingIds);
      overdueItems = result.data;
    }

    const { data: meetings, error } = await queryBuilder;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (matchedOrder.length > 0 && meetings) {
      meetings.sort((a: { id: string }, b: { id: string }) => matchedOrder.indexOf(a.id) - matchedOrder.indexOf(b.id));
    }

    const meetingIdsForCounts = meetings?.map((m: { id: string }) => m.id) ?? [];

    const actionCounts: Record<string, { total: number; overdue: number }> = {};
    const decisionCounts: Record<string, number> = {};

    if (meetingIdsForCounts.length > 0) {
      const { data: allActionItems } = await supabase
        .from("action_items")
        .select("meeting_id, is_completed, due_date")
        .in("meeting_id", meetingIdsForCounts);

      if (allActionItems) {
        const today = new Date().toISOString().split("T")[0];
        for (const item of allActionItems as Array<{ meeting_id: string; is_completed: boolean; due_date: string | null }>) {
          if (!actionCounts[item.meeting_id]) {
            actionCounts[item.meeting_id] = { total: 0, overdue: 0 };
          }
          actionCounts[item.meeting_id].total++;
          if (!item.is_completed && item.due_date && item.due_date < today) {
            actionCounts[item.meeting_id].overdue++;
          }
        }
      }

      const { data: allDecisions } = await supabase
        .from("key_decisions")
        .select("meeting_id")
        .in("meeting_id", meetingIdsForCounts);

      if (allDecisions) {
        for (const d of allDecisions as Array<{ meeting_id: string }>) {
          decisionCounts[d.meeting_id] = (decisionCounts[d.meeting_id] || 0) + 1;
        }
      }
    }

    const formatted = meetings?.map((m: { id: string; title: string; created_at: string; summary: string; is_public: boolean; share_token: string | null; template_name: string | null }) => ({
      id: m.id,
      title: m.title || "Untitled Meeting",
      date: m.created_at,
      templateName: m.template_name || "general",
      summary: m.summary || "",
      isPublic: m.is_public,
      shareToken: m.share_token,
      tasks: actionCounts[m.id]?.total ?? 0,
      overdueTasks: actionCounts[m.id]?.overdue ?? 0,
      decisions: decisionCounts[m.id] ?? 0,
    }));

    return NextResponse.json({
      meetings: formatted || [],
      overdueCount: overdueItems?.length ?? 0,
      overdueItems: overdueItems ?? [],
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
    let templateName: string | undefined;
    let language: string | undefined;
    let uploadedFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const { fields, file } = await parseMultipartBody(request);

      transcript = fields.transcript || undefined;
      title = fields.title || undefined;
      audioUrl = fields.audioUrl || undefined;
      templateName = fields.templateName || undefined;
      language = fields.language || undefined;
      uploadedFile = file;
    } else {
      const body = await request.json();
      ({ transcript, title, audioUrl, templateName, language } = body as {
        transcript?: string;
        title?: string;
        audioUrl?: string;
        templateName?: string;
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
      const result = await processMeetingWithAI(effectiveTranscript, templateContext, new Date().toISOString());
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
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error creating meeting:", message, err);
    return NextResponse.json(
      { error: `Failed to create meeting: ${message}` },
      { status: 500 }
    );
  }
}
