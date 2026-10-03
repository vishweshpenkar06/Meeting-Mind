import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: meetingId } = await params;

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const renames = Array.isArray(body.renames) ? body.renames : [];

  if (renames.length === 0) {
    return NextResponse.json({ error: "renames is required" }, { status: 400 });
  }

  // Group by target label so each speaker is one UPDATE regardless of how many
  // segments they own
  const byTarget = new Map<string, string>();
  for (const entry of renames) {
    const from = String(entry?.from ?? "").trim();
    const to = String(entry?.to ?? "").trim();
    if (!from || !to || from === to) continue;
    if (to.length > 60) {
      return NextResponse.json({ error: "Speaker names are limited to 60 characters" }, { status: 400 });
    }
    byTarget.set(from, to);
  }

  if (byTarget.size === 0) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  let updated = 0;
  for (const [from, to] of byTarget) {
    const { data, error } = await supabase
      .from("transcript_segments")
      .update({ speaker: to })
      .eq("meeting_id", meetingId)
      .eq("speaker", from)
      .select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    updated += data?.length ?? 0;
  }

  return NextResponse.json({ success: true, updated });
}