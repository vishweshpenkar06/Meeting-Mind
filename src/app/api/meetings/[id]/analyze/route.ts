import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processMeetingWithAI, diarizeTranscript } from "@/lib/ai-providers";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { getTemplate } from "@/lib/templates";
import { limitFor } from "@/lib/rate-limit";
import { computeQualityMetrics } from "@/lib/metrics";

/**
 * Resolves a template name to its prompt context. Built-ins come from the
 * static map; custom templates are looked up against the caller's own rows so
 * one user cannot borrow another's prompt context.
 */
async function resolveTemplateContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  templateName: string | null
) {
  if (!templateName) return getTemplate(undefined)?.aiPromptContext;
  const builtIn = getTemplate(templateName)?.aiPromptContext;
  if (builtIn) return builtIn;

  const { data } = await supabase
    .from("meeting_templates")
    .select("ai_prompt_context")
    .eq("user_id", userId)
    .eq("name", templateName)
    .maybeSingle();

  return data?.ai_prompt_context || undefined;
}

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

    const budget = limitFor(user.id, "analyze");
    if (!budget.ok) {
      return NextResponse.json(
        { error: "Analysis limit reached. Try again later." },
        { status: 429, headers: { "Retry-After": String(budget.retryAfter) } }
      );
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

    const templateName = (meeting as { template_name?: string | null }).template_name || null;
    const result = await processMeetingWithAI(
      meeting.raw_transcript || "",
      await resolveTemplateContext(supabase, user.id, templateName),
      meeting.created_at
    );

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

    const { error: deleteErr } = await supabase.from("action_items").delete().eq("meeting_id", id);
    if (deleteErr) console.warn("Could not clear existing action items:", deleteErr.message);
    const { error: deleteDecisionsErr } = await supabase.from("key_decisions").delete().eq("meeting_id", id);
    if (deleteDecisionsErr) console.warn("Could not clear existing decisions:", deleteDecisionsErr.message);

    if (result.actionItems.length > 0) {
      const { error: insertErr } = await supabase.from("action_items").insert(
        result.actionItems.map((item) => ({
          meeting_id: id,
          owner_name: item.owner,
          task_description: item.task,
          due_date: item.dueDate || null,
        }))
      );
      if (insertErr) console.warn("Failed saving action items:", insertErr.message);
    }

    if (result.decisions.length > 0) {
      const { error: insertErr } = await supabase.from("key_decisions").insert(
        result.decisions.map((d) => ({
          meeting_id: id,
          decision_text: typeof d === "string"
            ? d
            : typeof d === "object" && d !== null
              ? String(d.decision || JSON.stringify(d))
              : String(d),
        }))
      );
      if (insertErr) console.warn("Failed saving decisions:", insertErr.message);
    }

    try {
      const transcript = meeting.raw_transcript || "";
      if (transcript.length > 50) {
        const segments = await diarizeTranscript(transcript);
        if (segments.length > 0) {
          const { error: segDeleteErr } = await supabase.from("transcript_segments").delete().eq("meeting_id", id);
          if (segDeleteErr) console.warn("Could not clear existing segments:", segDeleteErr.message);
          const { error: segInsertErr } = await supabase.from("transcript_segments").insert(
            segments.map((seg) => ({
              meeting_id: id,
              speaker: seg.speaker,
              text: seg.text,
              start_time: null,
              end_time: null,
            }))
          );
          if (segInsertErr) console.warn("Failed saving segments:", segInsertErr.message);

          // Talk-distribution metrics need the diarized segments, so they are
          // computed here rather than at meeting-creation time
          const metrics = computeQualityMetrics(
            segments.map((s) => ({ speaker: s.speaker, text: s.text }))
          );

          // sentiment_pct stays 0: there is no sentiment signal in the analysis
          // result, and a word-count heuristic would be worse than an honest zero
          const { error: metricsErr } = await supabase
            .from("meeting_quality_metrics")
            .upsert(
              {
                meeting_id: id,
                sentiment_pct: 0,
                engagement_pct: metrics.engagement_pct,
                monologue_pct: metrics.monologue_pct,
                action_item_completion_pct: 0,
                participant_count: metrics.participant_count,
                computed_at: new Date().toISOString(),
              },
              { onConflict: "meeting_id" }
            );
          if (metricsErr) console.warn("Failed saving quality metrics:", metricsErr.message);
        }
      }
    } catch (diarizationError) {
      console.warn("Diarization failed (non-blocking):", diarizationError);
    }

    try {
      const { error: notesDeleteErr } = await supabase.from("meeting_notes").delete().eq("meeting_id", id);
      if (notesDeleteErr) console.warn("Could not clear existing notes:", notesDeleteErr.message);

      const noteSections: Array<[string, unknown]> = [
        ["keyTopics", result.keyTopics],
        ["risks", result.risks],
        ["followUps", result.followUps],
      ].filter(([, value]) => Array.isArray(value) && value.length > 0) as Array<[string, unknown]>;

      if (noteSections.length > 0) {
        const { error: notesInsertErr } = await supabase.from("meeting_notes").insert(
          noteSections.map(([section, value]) => ({
            meeting_id: id,
            section,
            content: JSON.stringify(value),
          }))
        );
        if (notesInsertErr) console.warn("Failed saving notes:", notesInsertErr.message);
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
