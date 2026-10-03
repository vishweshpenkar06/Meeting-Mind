import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { limitFor } from "@/lib/rate-limit";

/** Stored palette, so tag colours stay recognisable across sessions and devices. */
const TAG_COLORS = ["#4F8EF7", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetingId = new URL(request.url).searchParams.get("meetingId");

  if (meetingId) {
    // Confirm ownership before exposing which tags a meeting carries
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id")
      .eq("id", meetingId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("meeting_tags")
      .select("tag_id, tags(id, name, color)")
      .eq("meeting_id", meetingId);
    if (error) {
      console.warn("meeting_tags query failed:", error.message);
      return NextResponse.json({ tags: [] });
    }

    const rows = (data || []) as unknown as Array<{ tags: { id: string; name: string; color: string } | null }>;
    return NextResponse.json({ tags: rows.map((r) => r.tags).filter(Boolean) });
  }

  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) {
    console.warn("tags query failed:", error.message);
    return NextResponse.json({ tags: [] });
  }

  return NextResponse.json({ tags: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const budget = limitFor(user.id, "create");
  if (!budget.ok) {
    return NextResponse.json(
      { error: "Tag limit reached. Try again later." },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const meetingId = body.meetingId ? String(body.meetingId) : null;

  if (!name) {
    return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: "Tag names are limited to 40 characters" }, { status: 400 });
  }

  // Reuse the tag if it already exists for this user
  const { data: existing } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", user.id)
    .eq("name", name)
    .maybeSingle();

  let tag = existing;
  if (!tag) {
    const { data: count } = await supabase
      .from("tags")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { data: created, error: insertErr } = await supabase
      .from("tags")
      .insert({
        user_id: user.id,
        name,
        color: body.color || TAG_COLORS[((count ?? 0) as number) % TAG_COLORS.length],
      })
      .select("id, name, color")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    tag = created;
  }

  if (!meetingId) {
    return NextResponse.json(tag, { status: 201 });
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // on_conflict makes tagging idempotent — double-clicking a tag is a no-op
  const { error: linkErr } = await supabase
    .from("meeting_tags")
    .upsert({ meeting_id: meetingId, tag_id: tag.id }, { onConflict: "meeting_id,tag_id", ignoreDuplicates: true });

  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  return NextResponse.json(tag, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tagId = url.searchParams.get("tagId");
  const meetingId = url.searchParams.get("meetingId");

  if (!tagId) {
    return NextResponse.json({ error: "tagId is required" }, { status: 400 });
  }

  const { data: tag } = await supabase
    .from("tags")
    .select("id")
    .eq("id", tagId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  if (meetingId) {
    // Detach from one meeting, keep the tag
    const { error } = await supabase
      .from("meeting_tags")
      .delete()
      .eq("tag_id", tagId)
      .eq("meeting_id", meetingId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase.from("tags").delete().eq("id", tagId).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}