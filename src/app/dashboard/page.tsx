"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Search, X, Trash2, Calendar, CheckCircle2, FileText, CircleDot, ChevronDown, ChevronUp, AlertTriangle, ArrowUpDown, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { daysUntil, formatShortDate } from "@/lib/dates";
import { Button, EmptyState, SkeletonCard } from "@/components/ui";

const TEMPLATE_META: Record<string, { label: string; color: string }> = {
  general: { label: "General", color: "var(--color-cat-1)" },
  standup: { label: "Standup", color: "var(--color-cat-3)" },
  retro: { label: "Retro", color: "var(--color-cat-4)" },
  "one-on-one": { label: "1:1", color: "var(--color-cat-2)" },
  "client-call": { label: "Client", color: "var(--color-cat-5)" },
  brainstorm: { label: "Brainstorm", color: "var(--color-cat-6)" },
};

interface OverdueItem {
  id: string;
  task_description: string;
  owner_name: string;
  meeting_id: string;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  templateName?: string;
  summary?: string;
  isPublic?: boolean;
  shareToken?: string;
  tasks: number;
  overdueTasks: number;
  decisions: number;
}

export default function DashboardPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [overdueItems, setOverdueItems] = useState<OverdueItem[]>([]);
  const [dismissOverdue, setDismissOverdue] = useState(false);
  const [showOverdueList, setShowOverdueList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [filterTemplate, setFilterTemplate] = useState<string>("all");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Only the newest request may write state; older ones are aborted
  const fetchMeetings = useCallback(async (query?: string) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    try {
      const url = query ? `/api/meetings?q=${encodeURIComponent(query)}` : "/api/meetings";
      const res = await fetch(url, { signal: controller.signal });
      if (controller.signal.aborted) return;

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setLoadError(payload?.error || `Could not load meetings (${res.status})`);
        return;
      }

      const data = await res.json();
      setLoadError(null);
      setMeetings(data.meetings ?? []);
      setOverdueCount(data.overdueCount ?? 0);
      setOverdueItems(data.overdueItems ?? []);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Failed to fetch meetings:", err);
      setLoadError("Could not load meetings. Check your connection and try again.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setSearchLoading(false);
      }
    }
  }, []);

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

  // Doubles as the initial load, so no separate mount fetch is needed
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!search.trim()) {
      fetchMeetings();
      return () => searchAbortRef.current?.abort();
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
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setLoadError(payload?.error || "Could not delete the meeting. It may already be gone.");
        return;
      }
      setLoadError(null);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      // Overdue totals span every meeting, so they must come back from the server
      fetchMeetings(search.trim() || undefined);
    } catch {
      setLoadError("Could not delete the meeting. Check your connection and try again.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const offset = daysUntil(dateStr);
    if (offset === null) return "";
    if (offset === 0) return "Today";
    if (offset === -1) return "Yesterday";
    if (offset > -7) return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" });
    return formatShortDate(dateStr);
  };

  const sortedFiltered = [...meetings]
    .filter((m) => filterTemplate === "all" || m.templateName === filterTemplate)
    .sort((a, b) => sortBy === "newest"
      ? new Date(b.date).getTime() - new Date(a.date).getTime()
      : new Date(a.date).getTime() - new Date(b.date).getTime()
    );

  const isSearching = search.trim().length > 0;
  const scopeSuffix = isSearching ? " matching your search" : "";
  const totalTasks = meetings.reduce((sum, m) => sum + m.tasks, 0);
  const totalDecisions = meetings.reduce((sum, m) => sum + m.decisions, 0);

  return (
    <div className="page-container pt-8 pb-16">
        {loadError && (
          <div className="mb-4 bg-error-muted/50 border border-error/20 rounded-xl px-4 py-3 text-sm text-error">
            {loadError}
          </div>
        )}

        {overdueCount > 0 && !dismissOverdue && (
          <div className="mb-4 bg-warning-muted/50 border border-warning/20 rounded-xl overflow-hidden">
            <div className="flex items-stretch">
              <button
                onClick={() => setShowOverdueList(!showOverdueList)}
                aria-expanded={showOverdueList}
                className="flex-1 px-4 py-2.5 flex items-center justify-between text-sm hover:bg-warning-muted/30 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                  <span className="text-warning font-medium text-xs">{overdueCount} overdue task{overdueCount > 1 ? 's' : ''}</span>
                </span>
                {showOverdueList ? <ChevronUp className="w-3.5 h-3.5 text-warning/60" /> : <ChevronDown className="w-3.5 h-3.5 text-warning/60" />}
              </button>
              <button
                onClick={() => setDismissOverdue(true)}
                aria-label="Dismiss overdue tasks banner"
                className="px-4 flex items-center text-warning/60 hover:text-warning text-xs transition-colors"
              >
                Dismiss
              </button>
            </div>
            {showOverdueList && (
              <div className="px-4 pb-3 space-y-1.5">
                {overdueItems.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => router.push(`/meeting/${item.meeting_id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-warning-muted/30 transition-colors text-left"
                  >
                    <span className="text-[11px] text-text-muted font-mono flex-shrink-0">{item.owner_name}</span>
                    <span className="text-xs text-text-primary truncate flex-1">{item.task_description}</span>
                  </button>
                ))}
                {overdueItems.length > 8 && (
                  <p className="text-[11px] text-warning/60 text-center">+{overdueItems.length - 8} more</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="font-display font-bold text-xl text-text-primary">
              Meetings
            </h1>
            <div className="hidden sm:flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1.5" title={`${meetings.length} meetings${scopeSuffix}`}>
                <CircleDot className="w-3 h-3 text-accent-primary" />
                {meetings.length} total
              </span>
              <span className="flex items-center gap-1.5" title={`${totalTasks} action items${scopeSuffix}`}>
                <CheckCircle2 className="w-3 h-3 text-accent-purple" />
                {totalTasks} tasks
              </span>
              <span className="flex items-center gap-1.5" title={`${totalDecisions} key decisions${scopeSuffix}`}>
                <FileText className="w-3 h-3 text-success" />
                {totalDecisions} decisions
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

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              id="search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search meetings..."
              className="w-full bg-bg-elevated/50 border border-border-subtle rounded-xl pl-10 pr-10 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-colors"
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
          <div className="relative">
            <select
              value={filterTemplate}
              onChange={(e) => setFilterTemplate(e.target.value)}
              className="appearance-none bg-bg-elevated/50 border border-border-subtle rounded-xl pl-3 pr-8 py-2.5 text-text-secondary text-xs cursor-pointer focus:border-accent-primary focus:outline-none"
            >
              <option value="all">All types</option>
              {Object.entries(TEMPLATE_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          </div>
          <button
            onClick={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1.5 px-3 py-2 bg-bg-elevated/50 border border-border-subtle rounded-xl text-text-secondary text-xs hover:text-text-primary hover:border-border-default transition-colors"
            title={`Sort by ${sortBy === "newest" ? "oldest first" : "newest first"}`}
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === "newest" ? "Newest" : "Oldest"}
          </button>
        </div>

        {loading ? (
          <div aria-busy="true" aria-label="Loading meetings">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} className="mb-2" />
            ))}
          </div>
        ) : sortedFiltered.length === 0 && search ? (
          <EmptyState
            icon={<Search className="w-5 h-5" />}
            title="No results"
            description={`No meetings match "${search}"`}
          />
        ) : sortedFiltered.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-5 h-5" />}
            title="No meetings yet"
            description="Upload a recording or paste a transcript to get started."
            action={
              <Button onClick={() => router.push("/dashboard/new")}>
                <Plus className="w-4 h-4" aria-hidden="true" />
                New Meeting
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col">
            {sortedFiltered.map((m) => {
              const meta = TEMPLATE_META[m.templateName || "general"] || TEMPLATE_META.general;
              return (
                <div
                  key={m.id}
                  className="relative group flex items-center gap-3 px-4 py-3 border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated/40 transition-colors duration-100 cursor-pointer rounded-xl"
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-medium text-text-primary truncate">
                        {m.title || "Untitled Meeting"}
                      </h3>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                    {m.summary ? (
                      <p className="text-[11px] text-text-muted mt-0.5 truncate">{m.summary.slice(0, 80)}{m.summary.length > 80 ? "..." : ""}</p>
                    ) : null}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-text-muted font-mono">
                        {formatDate(m.date)}
                      </span>
                      {m.tasks > 0 && (
                        <span className="text-[11px] text-text-muted">
                          {"\u00B7"} {m.tasks} task{m.tasks === 1 ? "" : "s"}
                          {m.overdueTasks > 0 && <span className="text-warning"> ({m.overdueTasks} overdue)</span>}
                        </span>
                      )}
                      {m.decisions > 0 && (
                        <span className="text-[11px] text-text-muted">
                          {"\u00B7"} {m.decisions} decision{m.decisions === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(m.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-all duration-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
