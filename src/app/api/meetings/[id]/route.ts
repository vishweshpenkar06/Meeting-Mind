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
      .select(`
        *,
        action_items(*),
        key_decisions(*)
      `)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.is_public && meeting.share_token) {
      return NextResponse.json(meeting);
    }

    if (!user || meeting.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(meeting);
  } catch (err) {
    console.error("Error fetching meeting:", err);
    return NextResponse.json(
      { error: "Failed to fetch meeting" },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: "Failed to delete meeting" },
      { status: 500 }
    );
  }
}
