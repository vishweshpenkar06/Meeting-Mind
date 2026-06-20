import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as nodeCrypto from "node:crypto";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Meeting fetch error:", error.message, "id:", id);
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const isOwner = user && meeting.user_id === user.id;
    const isPublic = meeting.is_public && meeting.share_token;

    if (!isOwner && !isPublic) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let actionItems: unknown[] = [];
    let keyDecisions: unknown[] = [];
    let keyTopics: string[] = [];
    let risks: Array<{ risk: string; mitigation?: string }> = [];
    let followUps: string[] = [];
    let segments: unknown[] = [];

    try {
      const { data } = await supabase.from("action_items").select("*").eq("meeting_id", id);
      actionItems = data || [];
    } catch { /* table may not exist */ }

    try {
      const { data } = await supabase.from("key_decisions").select("*").eq("meeting_id", id);
      keyDecisions = data || [];
    } catch { /* table may not exist */ }

    try {
      const { data: notes } = await supabase.from("meeting_notes").select("section, content").eq("meeting_id", id);
      if (notes) {
        const kt = notes.find((n) => n.section === "keyTopics");
        const r = notes.find((n) => n.section === "risks");
        const fu = notes.find((n) => n.section === "followUps");
        if (kt) keyTopics = JSON.parse(kt.content);
        if (r) risks = JSON.parse(r.content);
        if (fu) followUps = JSON.parse(fu.content);
      }
    } catch { /* table may not exist */ }

    try {
      const { data } = await supabase.from("transcript_segments").select("*").eq("meeting_id", id).order("created_at", { ascending: true });
      segments = data || [];
    } catch { /* table may not exist */ }

    return NextResponse.json({
      ...meeting,
      action_items: actionItems,
      key_decisions: keyDecisions,
      keyTopics,
      risks,
      followUps,
      transcript_segments: segments,
    });
  } catch (err) {
    console.error("Error fetching meeting:", err);
    return NextResponse.json({ error: "Failed to fetch meeting" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.summary !== undefined) updates.summary = body.summary;
    if (body.raw_transcript !== undefined) updates.raw_transcript = body.raw_transcript;
    if (body.is_public !== undefined) {
      updates.is_public = body.is_public;
      const token = body.is_public ? nodeCrypto.randomUUID() : null;
      updates.share_token = token;
    }

    const { data: meeting, error } = await supabase
      .from("meetings")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(meeting);
  } catch (err) {
    console.error("Error updating meeting:", err);
    return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("meetings")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete meeting" }, { status: 500 });
  }
}
