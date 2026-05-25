import { createClient } from "@/lib/supabase/server";
import { streamObject, embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const MeetingSchema = z.object({
  title: z.string().describe("A meeting title (5 words max)"),
  summary: z.string().describe("A concise summary (3-5 sentences, key themes only)"),
  decisions: z.array(z.string()).describe("Key decisions made (bullet points)"),
  actionItems: z.array(
    z.object({
      owner: z.string().describe("Person's name or 'Unassigned'"),
      task: z.string().describe("Clear description of the task"),
      dueDate: z.string().nullable().describe("ISO date string or null if none"),
    })
  ).describe("Action items identified in the meeting"),
});

const SYSTEM_PROMPT = `You are an expert meeting analyst. Extract structured, actionable insights from meeting transcripts.
Always return valid JSON matching the specified schema. Be precise and concise — never invent information not present in the transcript.

For action item due dates, use these rules:
- If a specific date is mentioned, return it in ISO format (YYYY-MM-DD)
- If a relative day is mentioned ("tomorrow", "next Friday"), return the most logical date
- If no deadline is mentioned, return null
- If the date is ambiguous, return null

For owner names:
- Use the person's actual name from the transcript
- If no owner is mentioned, use "Unassigned"`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Fetch meeting and template context
    const { data: meeting, error: fetchError } = await supabase
      .from("meetings")
      .select("*, meeting_templates(ai_prompt_context)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !meeting) {
      return new Response("Meeting not found", { status: 404 });
    }

    if (meeting.analysis_status === "completed" && meeting.summary) {
      return new Response("Meeting already analyzed", { status: 400 });
    }

    const templateContext = meeting.meeting_templates?.ai_prompt_context;
    const fullSystemPrompt = templateContext 
      ? `${templateContext}\n\n${SYSTEM_PROMPT}` 
      : SYSTEM_PROMPT;

    const result = await streamObject({
      model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
      schema: MeetingSchema,
      system: fullSystemPrompt,
      prompt: `Analyze this meeting transcript and extract the requested fields.\n\nTranscript:\n---\n${meeting.raw_transcript}\n---`,
      temperature: 0.3,
      onFinish: async ({ object }) => {
        if (!object) return;

        const aiTitle = object.title || meeting.title;
        
        await supabase
          .from("meetings")
          .update({
            title: aiTitle,
            summary: object.summary,
            analysis_status: "completed",
          })
          .eq("id", id);

        if (object.actionItems && object.actionItems.length > 0) {
          const itemsToInsert = object.actionItems.map((item: { owner: string; task: string; dueDate: string | null }) => ({
            meeting_id: id,
            owner_name: item.owner,
            task_description: item.task,
            due_date: item.dueDate || null,
          }));
          await supabase.from("action_items").insert(itemsToInsert);
        }

        if (object.decisions && object.decisions.length > 0) {
          const decisionsToInsert = object.decisions.map((text: string) => ({
            meeting_id: id,
            decision_text: text,
          }));
          await supabase.from("key_decisions").insert(decisionsToInsert);
        }

        // Generate and save semantic embedding
        try {
          const searchContent = [
            aiTitle,
            object.summary,
            ...(object.decisions || []),
            ...(object.actionItems?.map(a => `${a.task} (Owner: ${a.owner})`) || []),
          ].join("\n");

          const { embedding } = await embed({
            model: openai.embedding("text-embedding-3-small"),
            value: searchContent,
          });

          await supabase
            .from("meetings")
            .update({ embedding })
            .eq("id", id);
        } catch (embedError) {
          console.error("Failed to generate embedding:", embedError);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Streaming error:", error);
    return new Response("Streaming failed", { status: 500 });
  }
}
