"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, CheckCircle, Clock, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

interface AnalyticsData {
  totalMeetings: number;
  totalMinutes: number;
  avgCompletionRate: number;
  avgSentiment: number;
  weeklyData: Array<{ week: string; count: number; hours: number }>;
  meetingTypes: Record<string, number>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const maxHours = Math.max(...(data?.weeklyData.map((w) => w.hours) || [1]), 1);

  return (
    <div className="min-h-screen bg-bg-base max-w-[800px] mx-auto px-6 pt-8 pb-24">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium hover:bg-bg-elevated/50 px-3 py-2 rounded-lg -ml-3 mb-8 w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-[family:var(--font-syne)] font-bold text-[32px] text-text-primary" style={{ lineHeight: "1.15" }}>
          Meeting Analytics
        </h1>
        <p className="text-text-secondary text-base mt-1">
          Insights about your meeting patterns and productivity
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-text-muted text-sm">Loading analytics...</div>
        </div>
      ) : !data ? (
        <div className="text-center py-16">
          <BarChart3 className="w-10 h-10 text-text-muted mx-auto mb-4 opacity-50" />
          <h3 className="text-text-secondary font-semibold text-lg mb-2">No data yet</h3>
          <p className="text-text-muted text-sm">Start creating meetings to see your analytics.</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard icon={<Clock className="w-4 h-4" />} value={`${data.totalMeetings}`} label="Total Meetings" />
            <StatCard icon={<Clock className="w-4 h-4" />} value={`${data.totalMinutes}m`} label="Time in Meetings" />
            <StatCard icon={<CheckCircle className="w-4 h-4" />} value={`${data.avgCompletionRate}%`} label="Task Completion" />
            <StatCard icon={<TrendingUp className="w-4 h-4" />} value={data.avgSentiment >= 0 ? `+${data.avgSentiment}%` : `${data.avgSentiment}%`} label="Avg Sentiment" />
          </div>

          {/* Weekly Meeting Hours Chart */}
          <div className="mb-8 bg-bg-surface border border-border-subtle rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-6">Weekly Meeting Hours (last 8 weeks)</h3>
            <div className="flex items-end gap-2 h-32">
              {data.weeklyData.map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-text-muted">{w.hours > 0 ? `${w.hours}h` : ""}</span>
                  <div className="w-full bg-bg-elevated rounded-t-sm relative overflow-hidden" style={{ height: "100%" }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t-sm transition-all duration-500"
                      style={{
                        height: `${(w.hours / maxHours) * 100}%`,
                        background: w.hours > 2 ? "var(--gradient-hero)" : "#4F8EF7",
                        opacity: w.hours > 0 ? 0.8 : 0.3,
                      }}
                    />
                  </div>
                  <span className="text-xs text-text-muted truncate w-full text-center">{w.week}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Meeting Types */}
          <div className="mb-8 bg-bg-surface border border-border-subtle rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Meeting Types</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(data.meetingTypes).map(([type, count]) => (
                <div key={type} className="bg-bg-elevated rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#4F8EF7" }} />
                  <span className="text-sm text-text-primary capitalize">{type}</span>
                  <span className="text-xs text-text-muted">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiment Meter */}
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Overall Meeting Sentiment</h3>
            <div className="relative h-3 bg-bg-elevated rounded-full overflow-hidden mb-2">
              <div
                className="absolute h-full rounded-full transition-all duration-500"
                style={{
                  left: `${data.avgSentiment < 0 ? 50 + data.avgSentiment / 2 : 50}%`,
                  width: `${Math.abs(data.avgSentiment) / 2}%`,
                  background: data.avgSentiment >= 0
                    ? "linear-gradient(90deg, #34D399, #10B981)"
                    : "linear-gradient(90deg, #F87171, #EF4444)",
                }}
              />
              <div className="absolute left-1/2 w-0.5 h-full bg-text-muted/20" />
            </div>
            <div className="flex justify-between text-xs text-text-muted">
              <span>Negative (-100)</span>
              <span>Neutral (0)</span>
              <span>Positive (+100)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-xl px-5 py-4">
      <div className="text-text-muted mb-2">{icon}</div>
      <div className="text-2xl font-bold text-text-primary font-[family:var(--font-syne)]">{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{label}</div>
    </div>
  );
}
