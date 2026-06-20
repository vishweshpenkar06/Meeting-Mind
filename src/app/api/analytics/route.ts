import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error: queryError } = await supabase
      .from("meetings")
      .select("id, created_at, duration_seconds, meeting_type")
      .eq("user_id", user.id);

    let meetings: Array<{ id: string; created_at: string; duration_seconds?: number; meeting_type?: string }>;

    if (queryError) {
      const { data: fallback } = await supabase
        .from("meetings")
        .select("id, created_at")
        .eq("user_id", user.id);
      meetings = fallback ?? [];
    } else {
      meetings = data ?? [];
    }

    const { data: actionItems } = await supabase
      .from("action_items")
      .select("is_completed, due_date, meeting_id")
      .in(
        "meeting_id",
        meetings.map((m) => m.id)
      );

    const { data: qualityMetrics } = await supabase
      .from("meeting_quality_metrics")
      .select("*")
      .in(
        "meeting_id",
        meetings.map((m) => m.id)
      );

    const totalMeetings = meetings.length;
    const completedTasks = actionItems?.filter((a) => a.is_completed).length ?? 0;
    const totalTasks = actionItems?.length ?? 0;
    const avgCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    let totalMinutes = 0;
    const meetingTypes: Record<string, number> = {};
    for (const m of meetings) {
      totalMinutes += Number(m.duration_seconds || 0) / 60;
      const t = m.meeting_type || "general";
      meetingTypes[t] = (meetingTypes[t] || 0) + 1;
    }
    totalMinutes = Math.round(totalMinutes);

    const avgSentiment = qualityMetrics && qualityMetrics.length > 0
      ? Math.round(qualityMetrics.reduce((s, m) => s + (m.sentiment_pct || 0), 0) / qualityMetrics.length)
      : 0;

    const now = new Date();
    const weeklyData: Array<{ week: string; count: number; hours: number }> = [];
    for (let i = 8; i >= 1; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - (i * 7));
      const end = new Date(now);
      end.setDate(end.getDate() - ((i - 1) * 7));

      const weekMeetings = meetings.filter(
        (m) => new Date(m.created_at) >= start && new Date(m.created_at) < end
      );
      let weekHours = 0;
      for (const m of weekMeetings) {
        weekHours += Number(m.duration_seconds || 0) / 3600;
      }
      weeklyData.push({
        week: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count: weekMeetings.length,
        hours: Math.round(weekHours * 10) / 10,
      });
    }

    return NextResponse.json({
      totalMeetings,
      totalMinutes,
      avgCompletionRate,
      avgSentiment,
      weeklyData,
      meetingTypes,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
