"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, ArrowRight, Search, X, Trash2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

interface Meeting {
  id: string;
  title: string;
  date: string;
  meetingType?: string;
  isPublic?: boolean;
  shareToken?: string;
  tasks: number;
  decisions: number;
}

export default function DashboardPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [overdueCount, setOverdueCount] = useState(0);
  const [dismissOverdue, setDismissOverdue] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = useCallback(async (query?: string) => {
    try {
      const url = query ? `/api/meetings?q=${encodeURIComponent(query)}` : "/api/meetings";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings ?? []);
        setOverdueCount(data.overdueCount ?? 0);
      }
    } catch (err) {
      console.error("Failed to fetch meetings:", err);
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, []);

  // Debounced full-text search
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!search.trim()) {
      // When empty, fetch without query param
      fetchMeetings();
      return;
    }

    setSearchLoading(true);
    searchTimerRef.current = setTimeout(() => {
      fetchMeetings(search);
    }, 300);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [search, fetchMeetings]);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMeetings((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      console.error("Failed to delete meeting");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const totalTasks = meetings.reduce((sum, m) => sum + m.tasks, 0);
  const totalDecisions = meetings.reduce((sum, m) => sum + m.decisions, 0);

  return (
    <div className="max-w-[720px] mx-auto px-6 pt-8 pb-16">
        {/* Overdue notification banner */}
        {overdueCount > 0 && !dismissOverdue && (
          <div className="mb-4 bg-warning-muted border border-warning/20 rounded-xl px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-warning font-medium">{"\u26A0"} You have {overdueCount} overdue task{overdueCount > 1 ? 's' : ''}</span>
            <button onClick={() => setDismissOverdue(true)} className="text-warning/60 hover:text-warning text-xs">Dismiss</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatCard value={meetings.length} label="Meetings" />
          <StatCard value={totalTasks} label="Tasks" />
          <StatCard value={totalDecisions} label="Decisions" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-[family:var(--font-syne)] font-bold text-2xl text-text-primary">
            Your Meetings
          </h1>
          <button
            onClick={() => router.push("/dashboard/new")}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse text-sm font-semibold px-4 py-2.5 rounded-[10px] transition-all duration-200 hover:shadow-[0_0_20px_rgba(79,142,247,0.25)]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Meeting</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meetings..."
            className="w-full bg-bg-surface border border-border-subtle rounded-xl pl-10 pr-10 py-3 text-text-primary text-sm placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-[0_0_0_3px_rgba(79,142,247,0.15)] transition-all"
          />
          {searchLoading ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-text-muted/30 border-t-accent-primary rounded-full animate-spin" />
            </div>
          ) : search ? (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Meeting Cards */}
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-bg-surface border border-border-subtle rounded-[14px] px-6 py-5 mb-3 animate-pulse"
            >
              <div className="h-4 w-40 bg-bg-elevated rounded mb-2" />
              <div className="h-3 w-20 bg-bg-elevated rounded" />
            </div>
          ))
        ) : meetings.length === 0 && search ? (
          // No search results
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-text-muted mx-auto mb-4 opacity-50" />
            <h3 className="text-text-secondary font-semibold text-lg mb-2">
              No meetings found
            </h3>
            <p className="text-text-muted text-sm">
              No meetings match &quot;{search}&quot;
            </p>
          </div>
        ) : meetings.length === 0 ? (
          // Empty state
          <div className="text-center py-16">
            <div className="text-5xl mb-4 opacity-30">{"\ud83d\udccb"}</div>
            <h3 className="text-text-secondary font-semibold text-lg mb-2">
              No meetings yet
            </h3>
            <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
              Upload your first meeting recording or paste a transcript to get started.
            </p>
            <button
              onClick={() => router.push("/dashboard/new")}
              className="flex items-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse text-sm font-semibold px-6 py-3 rounded-[10px] transition-all duration-200 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Your First Meeting
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {meetings.map((m, i) => (
              <div
                key={m.id}
                className="relative bg-bg-surface border rounded-[14px] px-6 py-5 group flex items-center justify-between hover:border-border-default hover:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_2px_8px_rgba(79,142,247,0.08)] hover:-translate-y-[1px] transition-all duration-200 cursor-pointer"
                onClick={() => router.push(`/meeting/${m.id}`)}
                style={{
                  borderLeft: `3px solid ${i % 3 === 0 ? "#4F8EF7" : i % 3 === 1 ? "#8B5CF6" : "#10B981"}`,
                  animation: `fadeInUp 0.4s ease ${i * 0.06}s both`,
                }}
              >
                {/* Delete overlay on long press or confirm */}
                {showDeleteConfirm === m.id && (
                  <div className="absolute inset-0 bg-bg-base/95 backdrop-blur-sm rounded-[14px] flex items-center justify-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
                    <span className="text-text-primary text-sm font-medium">Delete this meeting?</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                      disabled={deleting}
                      className="px-3 py-1.5 bg-error/20 text-error border border-error/30 rounded-lg text-xs font-medium hover:bg-error/30 transition-colors"
                    >
                      {deleting ? "..." : "Delete"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(null); }}
                      className="px-3 py-1.5 bg-bg-elevated text-text-secondary rounded-lg text-xs font-medium hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[15px] font-semibold text-text-primary font-[family:var(--font-dm-sans)] truncate">
                      {m.title || "Untitled Meeting"}
                    </h3>
                    {m.meetingType && (
                      <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary border border-border-subtle">
                        <FileText className="w-3 h-3" />
                        {m.meetingType}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-text-muted mt-0.5 font-[family:var(--font-jetbrains)]">
                    {formatDate(m.date)}{"\u00B7"} {m.shareToken || m.isPublic ? "Shared" : "Private"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[rgba(79,142,247,0.1)] text-accent-primary">
                      {m.tasks} {m.tasks === 1 ? "task" : "tasks"}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[rgba(139,92,246,0.1)] text-accent-purple">
                      {m.decisions} {m.decisions === 1 ? "decision" : "decisions"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(m.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200"
                    title="Delete meeting"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ArrowRight
                    className="w-4 h-4 text-text-muted group-hover:text-accent-primary transition-colors duration-200 opacity-0 group-hover:opacity-100"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && meetings.length > 0 && (
          <p className="text-center text-text-muted text-xs pt-8">
            {"\u26A1"} Processing your next meeting takes under 30s
          </p>
        )}

        <style jsx global>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-xl px-5 py-4">
      <div className="text-2xl font-bold text-text-primary font-[family:var(--font-syne)]">
        {value}
      </div>
      <div className="text-xs text-text-muted mt-0.5">{label}</div>
    </div>
  );
}
