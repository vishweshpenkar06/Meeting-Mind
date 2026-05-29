import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Overall stats
    const { data: meetings } = await supabase
      .from("meetings")
      .select("id, created_at")
      .eq("user_id", user.id);

    const { data: actionItems } = await supabase
      .from("action_items")
      .select("is_completed, due_date, meeting_id")
      .in(
        "meeting_id",
        (meetings || []).map((m) => m.id)
      );

    const { data: qualityMetrics } = await supabase
      .from("meeting_quality_metrics")
      .select("*")
      .in(
        "meeting_id",
        (meetings || []).map((m) => m.id)
      );

    const totalMeetings = meetings?.length ?? 0;
    const completedTasks = actionItems?.filter((a) => a.is_completed).length ?? 0;
    const totalTasks = actionItems?.length ?? 0;
    const avgCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Sentiment average
    const avgSentiment = qualityMetrics && qualityMetrics.length > 0
      ? Math.round(qualityMetrics.reduce((s, m) => s + (m.sentiment_pct || 0), 0) / qualityMetrics.length)
      : 0;

    // Weekly meeting hours (last 8 weeks)
    const now = new Date();
    const weeklyData: Array<{ week: string; count: number; hours: number }> = [];
    for (let i = 8; i >= 1; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - (i * 7));
      const end = new Date(now);
      end.setDate(end.getDate() - ((i - 1) * 7));

      const weekMeetings = (meetings || []).filter(
        (m) => new Date(m.created_at) >= start && new Date(m.created_at) < end
      );
      weeklyData.push({
        week: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count: weekMeetings.length,
        hours: 0,
      });
    }

    return NextResponse.json({
      totalMeetings,
      totalMinutes: 0,
      avgCompletionRate,
      avgSentiment,
      weeklyData,
      meetingTypes: { general: totalMeetings },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
