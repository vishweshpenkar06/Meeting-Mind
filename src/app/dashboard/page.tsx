"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Search, X, Trash2, Calendar, CheckCircle2, FileText, CircleDot } from "lucide-react";
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

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        router.push("/dashboard/new");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!search.trim()) {
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
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const totalTasks = meetings.reduce((sum, m) => sum + m.tasks, 0);
  const totalDecisions = meetings.reduce((sum, m) => sum + m.decisions, 0);

  return (
    <div className="max-w-[720px] mx-auto px-6 pt-8 pb-16">
        {/* Overdue notification */}
        {overdueCount > 0 && !dismissOverdue && (
          <div className="mb-4 bg-warning-muted/50 border border-warning/20 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-warning font-medium text-xs">{overdueCount} overdue task{overdueCount > 1 ? 's' : ''}</span>
            <button onClick={() => setDismissOverdue(true)} className="text-warning/60 hover:text-warning text-xs">Dismiss</button>
          </div>
        )}

        {/* Header with inline stats */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="font-[family:var(--font-space-grotesk)] font-bold text-xl text-text-primary">
              Meetings
            </h1>
            <div className="hidden sm:flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1.5">
                <CircleDot className="w-3 h-3 text-accent-primary" />
                {meetings.length}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-accent-purple" />
                {totalTasks}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-success" />
                {totalDecisions}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard/new")}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse text-sm font-medium px-4 py-2 rounded-xl transition-colors duration-150"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            id="search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meetings..."
            className="w-full bg-bg-elevated/50 border border-border-subtle rounded-xl pl-10 pr-10 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-[0_0_0_2px_rgba(79,142,247,0.1)] transition-colors"
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

        {/* Meeting List */}
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-bg-surface border border-border-subtle rounded-xl px-5 py-4 mb-2 animate-pulse">
              <div className="h-3.5 w-40 bg-bg-elevated rounded mb-2" />
              <div className="h-2.5 w-24 bg-bg-elevated rounded" />
            </div>
          ))
        ) : meetings.length === 0 && search ? (
          <div className="text-center py-16">
            <Search className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-text-secondary font-medium text-sm mb-1">No results</p>
            <p className="text-text-muted text-xs">No meetings match &quot;{search}&quot;</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border-subtle flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-5 h-5 text-text-muted" />
            </div>
            <p className="text-text-secondary font-medium text-sm mb-1">No meetings yet</p>
            <p className="text-text-muted text-xs mb-5 max-w-xs mx-auto">
              Upload a recording or paste a transcript to get started.
            </p>
            <button
              onClick={() => router.push("/dashboard/new")}
              className="flex items-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse text-sm font-medium px-5 py-2.5 rounded-xl transition-colors duration-150 mx-auto"
            >
              <Plus className="w-4 h-4" />
              New Meeting
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="relative group flex items-center gap-4 px-4 py-3.5 border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated/40 transition-colors duration-100 cursor-pointer rounded-xl"
                onClick={() => {
                  const q = search ? "?q=" + encodeURIComponent(search) : "";
                  router.push("/meeting/" + m.id + q);
                }}
              >
                {showDeleteConfirm === m.id && (
                  <div className="absolute inset-0 bg-bg-base/95 backdrop-blur-sm rounded-xl flex items-center justify-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
                    <span className="text-text-primary text-sm font-medium">Delete?</span>
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

                <div className="w-1 h-8 rounded-full flex-shrink-0" style={{
                  background: m.tasks > 0 ? "var(--color-accent-primary)" : "var(--color-border-default)"
                }} />

                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-medium text-text-primary truncate">
                    {m.title || "Untitled Meeting"}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5 font-[family:var(--font-jetbrains)]">
                    {formatDate(m.date)}
                    {m.tasks > 0 && ` \u00B7 ${m.tasks} task${m.tasks === 1 ? "" : "s"}`}
                  </p>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(m.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-all duration-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
