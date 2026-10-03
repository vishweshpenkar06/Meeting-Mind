"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Share2,
  Check,
  FileText,
  MoreHorizontal,
  Trash2,
  Loader2,
  Edit3,
  X,
  Eye,
  EyeOff,
  Clipboard,
  Download,
} from "lucide-react";
import { exportToPDF, downloadAsMarkdown, copyShareFormat } from "@/lib/exports";
import AudioPlayer from "@/components/AudioPlayer";
import InteractiveTranscript from "@/components/InteractiveTranscript";
import { formatShortDate, daysUntil } from "@/lib/dates";
import TagPicker from "@/components/TagPicker";
import { Tabs } from "@/components/ui";

interface ActionItem {
  id: string;
  owner_name: string;
  task_description: string;
  due_date: string | null;
  is_completed: boolean;
}

interface KeyDecision {
  id: string;
  decision_text: string;
}

interface TranscriptSegment {
  id: string;
  text: string;
  speaker: string | null;
  start_time: number | null;
  end_time: number | null;
}

interface Meeting {
  id: string;
  title: string;
  summary: string;
  created_at: string;
  share_token: string | null;
  is_public: boolean;
  audio_url: string | null;
  raw_transcript: string | null;
  keyTopics?: string[];
  risks?: Array<{ risk: string; mitigation?: string }>;
  followUps?: string[];
  action_items: ActionItem[];
  key_decisions: KeyDecision[];
  transcript_segments?: TranscriptSegment[];
}

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightQuery = searchParams.get("q") || "";
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [showToast, setShowToast] = useState<string | null>(null);
  const [requestedAnalysis, setRequestedAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"notes" | "actions" | "transcript">("notes");
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizationAttempted, setDiarizationAttempted] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemField, setEditingItemField] = useState<"owner" | "task" | "dueDate" | null>(null);
  const [editingItemValue, setEditingItemValue] = useState("");
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [editingDecisionValue, setEditingDecisionValue] = useState("");
  const [deleting, setDeleting] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const toastTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const timers = toastTimersRef.current;
    return () => {
      mountedRef.current = false;
      fetchAbortRef.current?.abort();
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const showToastFor = useCallback((message: string) => {
    setShowToast(message);
    const timer = setTimeout(() => {
      toastTimersRef.current.delete(timer);
      setShowToast(null);
    }, 2500);
    toastTimersRef.current.add(timer);
  }, []);

  const fetchMeeting = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    try {
      const res = await fetch(`/api/meetings/${params.id}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (res.ok) {
        const data = await res.json();
        setMeeting(data);
        setTitleValue(data.title || "");
        setError(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Meeting fetch failed:", res.status, errData);
        setError(errData.error || "Meeting not found or you don't have access");
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Failed to fetch meeting:", err);
      setError("Could not load meeting");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [params.id]);

  // A client-side navigation between /meeting/[id] URLs reuses this instance, so
  // per-meeting flags must be cleared or the next meeting is skipped entirely
  useEffect(() => {
    setLoading(true);
    setMeeting(null);
    setRequestedAnalysis(false);
    setDiarizationAttempted(false);
    setAnalysisError(null);
    setPendingItems(new Set());
  }, [params.id]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showMenu) setShowMenu(false);
        if (editTitle) { setEditTitle(false); setTitleValue(meeting?.title || ""); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        router.push("/dashboard");
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        if (meeting) downloadAsMarkdown(meeting);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showMenu, editTitle, meeting, router]);

  useEffect(() => {
    if (meeting && !meeting.summary && !requestedAnalysis) {
      setRequestedAnalysis(true);
      setIsAnalyzing(true);
      fetch(`/api/meetings/${params.id}/analyze`, { method: "POST" })
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to analyze meeting");
          }
          setAnalysisError(null);
          await fetchMeeting();
        })
        .catch((err) => {
          console.error("Analyze request failed:", err);
          setAnalysisError(err instanceof Error ? err.message : "Failed to analyze meeting");
        })
        .finally(() => {
          setIsAnalyzing(false);
        });
    }
  }, [meeting, params.id, requestedAnalysis, fetchMeeting]);

  useEffect(() => {
    if (
      activeTab === "transcript" &&
      meeting &&
      meeting.raw_transcript &&
      meeting.raw_transcript.length > 50 &&
      (!meeting.transcript_segments || meeting.transcript_segments.length === 0) &&
      !isDiarizing &&
      !diarizationAttempted
    ) {
      setIsDiarizing(true);
      setDiarizationAttempted(true);
      fetch(`/api/meetings/${params.id}/diarize`, { method: "POST" })
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Diarization failed (${res.status})`);
          }
          const data = await res.json();
          if (data.segments && data.segments.length > 0) {
            setMeeting((prev) => prev ? { ...prev, transcript_segments: data.segments } : prev);
          }
        })
        .catch((err) => {
          console.error("Diarization failed:", err);
          setDiarizationAttempted(false);
          setError(err instanceof Error ? err.message : "Speaker identification failed");
        })
        .finally(() => setIsDiarizing(false));
    }
  }, [activeTab, meeting, params.id, isDiarizing, diarizationAttempted]);

  const toggleItem = async (actionItemId: string) => {
    if (!meeting || pendingItems.has(actionItemId)) return;
    const item = meeting.action_items?.find((i) => i.id === actionItemId);
    if (!item) return;

    const newCompleted = !item.is_completed;
    setPendingItems((prev) => new Set(prev).add(actionItemId));
    setMeeting({
      ...meeting,
      action_items: meeting.action_items.map((i) =>
        i.id === actionItemId ? { ...i, is_completed: newCompleted } : i
      ),
    });

    try {
      const res = await fetch(`/api/meetings/${meeting.id}/action-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId, isCompleted: newCompleted }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Could not update task (${res.status})`);
      }
    } catch (err) {
      console.error("Failed to toggle:", err);
      setMeeting((prev) => prev ? {
        ...prev,
        action_items: prev.action_items.map((i) =>
          i.id === actionItemId ? { ...i, is_completed: !newCompleted } : i
        ),
      } : prev);
      setError(err instanceof Error ? err.message : "Could not update task");
    } finally {
      setPendingItems((prev) => {
        const next = new Set(prev);
        next.delete(actionItemId);
        return next;
      });
    }
  };

  const startEditItem = (itemId: string, field: "owner" | "task" | "dueDate", currentValue: string) => {
    setEditingItemId(itemId);
    setEditingItemField(field);
    setEditingItemValue(currentValue || "");
  };

  const saveEditItem = async () => {
    if (!meeting || !editingItemId || !editingItemField) return;

    const item = meeting.action_items.find((i) => i.id === editingItemId);
    if (!item) return;

    const updates: Record<string, unknown> = { actionItemId: editingItemId };
    if (editingItemField === "owner") updates.ownerName = editingItemValue;
    if (editingItemField === "task") updates.taskDescription = editingItemValue;
    if (editingItemField === "dueDate") updates.dueDate = editingItemValue || null;

    setMeeting({
      ...meeting,
      action_items: meeting.action_items.map((i) => {
        if (i.id !== editingItemId) return i;
        if (editingItemField === "owner") return { ...i, owner_name: editingItemValue };
        if (editingItemField === "task") return { ...i, task_description: editingItemValue };
        if (editingItemField === "dueDate") return { ...i, due_date: editingItemValue || null };
        return i;
      }),
    });

    setEditingItemId(null);
    setEditingItemField(null);

    try {
      const res = await fetch(`/api/meetings/${meeting.id}/action-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Could not save task (${res.status})`);
      }
    } catch (err) {
      console.error("Failed to save action item edit:", err);
      setError(err instanceof Error ? err.message : "Could not save task");
      fetchMeeting();
    }
  };

  const startEditDecision = (decisionId: string, currentText: string) => {
    setEditingDecisionId(decisionId);
    setEditingDecisionValue(currentText);
  };

  const saveEditDecision = async () => {
    // Clearing the text then clicking away must still leave edit mode
    if (!meeting || !editingDecisionId) return;
    const decisionId = editingDecisionId;
    const nextText = editingDecisionValue.trim();
    setEditingDecisionId(null);

    if (!nextText) {
      setError("Decision text cannot be empty");
      fetchMeeting();
      return;
    }

    const previous = meeting.key_decisions;
    setMeeting({
      ...meeting,
      key_decisions: meeting.key_decisions.map((d) =>
        d.id === decisionId ? { ...d, decision_text: nextText } : d
      ),
    });

    try {
      const res = await fetch(`/api/meetings/${meeting.id}/decisions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId, decisionText: nextText }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Could not save decision (${res.status})`);
      }
    } catch (err) {
      console.error("Failed to save decision edit:", err);
      setMeeting((prev) => prev ? { ...prev, key_decisions: previous } : prev);
      setError(err instanceof Error ? err.message : "Could not save decision");
    }
  };

  const handleShare = async () => {
    if (!meeting) return;

    let shareToken = meeting.share_token;
    if (!shareToken) {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: true }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Could not create a share link");
        return;
      }
      // The PATCH response carries the freshly minted token
      const updated = await res.json();
      shareToken = updated.share_token;
      setMeeting(updated);
    }

    if (!shareToken) {
      setError("Could not create a share link");
      return;
    }

    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setShowShareLink(true);
      setTimeout(() => {
        setCopied(false);
        setShowShareLink(false);
      }, 2000);
    } catch {
      setError("Could not copy to clipboard. Copy the link manually.");
    }
  };

  const togglePublic = async () => {
    if (!meeting) return;
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !meeting.is_public }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Could not change sharing");
        return;
      }
      const updated = await res.json();
      setMeeting(updated);
      setTitleValue(updated.title || "");
      showToastFor(updated.is_public ? "Meeting is now public" : "Meeting is now private");
    } catch (err) {
      console.error("Failed to toggle visibility:", err);
      setError("Could not change sharing. Check your connection and try again.");
    }
  };

  const saveTitle = async () => {
    if (!meeting || !titleValue.trim()) return;
    const nextTitle = titleValue.trim();
    setMeeting((prev) => prev ? { ...prev, title: nextTitle } : prev);
    setEditTitle(false);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Could not rename (${res.status})`);
      }
    } catch (err) {
      console.error("Failed to save title:", err);
      // Roll back only the title; other fields may have changed while awaiting
      setMeeting((prev) => prev ? { ...prev, title: meeting.title } : prev);
      setError(err instanceof Error ? err.message : "Could not rename meeting");
    }
  };

  const handleDelete = async () => {
    if (!meeting || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Could not delete the meeting");
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to delete:", err);
      setError("Could not delete the meeting. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell page-container pt-8 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-accent-primary animate-spin" />
          <span className="text-text-secondary text-sm">Loading meeting...</span>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="page-shell flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            {error || "Meeting Not Found"}
          </h1>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 text-accent-primary hover:underline text-sm"
          >
            Go back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (analysisError) {
    console.warn("Meeting analysis fallback or error:", analysisError);
  }

  const isProcessing = isAnalyzing;
  const displayTitle = meeting.title;
  const displaySummary = meeting.summary;
  const actionItems = meeting.action_items || [];
  const decisions = meeting.key_decisions || [];

  const completedCount = actionItems.filter((a: { is_completed?: boolean }) => a.is_completed).length;
  const progressPct = actionItems.length > 0 ? (completedCount / actionItems.length) * 100 : 0;

  return (
    <div className="page-shell page-container pt-6 pb-16">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors text-sm -ml-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>

        <div className="flex items-center gap-2 relative">
          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-xl transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute top-full right-0 mt-2 w-48 bg-bg-elevated border border-border-default rounded-xl py-1.5 shadow-lg z-20">
                  <button
                    onClick={() => { setEditTitle(true); setShowMenu(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface/50 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Rename
                  </button>
                  {meeting.share_token && (
                    <button
                      onClick={() => { togglePublic(); setShowMenu(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface/50 transition-colors"
                    >
                      {meeting.is_public ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {meeting.is_public ? "Make Private" : "Make Public"}
                    </button>
                  )}
                  <hr className="my-1 border-border-subtle" />
                  <button
                    disabled={deleting}
                    onClick={() => { setShowMenu(false); handleDelete(); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-error hover:bg-error-muted/50 transition-colors disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {deleting ? "Deleting..." : "Delete Meeting"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {analysisError && (
        <div className="mb-6 rounded-xl border border-warning/20 bg-warning-muted px-4 py-3 text-sm text-warning">
          {analysisError}
        </div>
      )}

      {/* Rename Modal */}
      {editTitle && (
        <div className="mb-6 bg-bg-elevated border border-border-default rounded-xl p-4"
          style={{ animation: "fadeInUp 0.2s ease both" }}>
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-accent-primary flex-shrink-0" />
            <input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditTitle(false); setTitleValue(meeting.title); } }}
              className="flex-1 bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              autoFocus
            />
            <button
              onClick={saveTitle}
              className="px-3 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary-hover transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setEditTitle(false); setTitleValue(meeting.title); }}
              className="px-2 py-2 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Meeting Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="font-display font-bold text-xl text-text-primary"
              style={{ lineHeight: "1.15" }}
            >
              {displayTitle || "Untitled Meeting"}
              {isProcessing && <Loader2 className="w-4 h-4 inline-block ml-2 text-accent-primary animate-spin" />}
            </h1>
            <p suppressHydrationWarning className="text-text-muted text-xs mt-1 font-mono">
              {new Date(meeting.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {actionItems.length > 0 && ` \u00B7 ${actionItems.length} task${actionItems.length === 1 ? "" : "s"}`}
            </p>
            <TagPicker meetingId={meeting.id} className="mt-3" />
          </div>
        </div>

        {/* Progress */}
        {actionItems.length > 0 && (
          <div className="mt-4">
            <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: progressPct === 100
                    ? "var(--color-success)"
                    : "var(--gradient-hero)",
                }}
              />
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              {completedCount}/{actionItems.length} completed
            </p>
          </div>
        )}
      </div>

      <div className="h-px bg-border-subtle my-6" />

      {/* Tab Bar */}
      <Tabs
        items={[
          { id: "notes", label: "Notes" },
          { id: "actions", label: "Actions", count: actionItems.length },
          { id: "transcript", label: "Transcript" },
        ]}
        value={activeTab}
        onChange={(id) => setActiveTab(id as "notes" | "actions" | "transcript")}
      />

      {/* === NOTES TAB === */}
      {activeTab === "notes" && (
        <div>
          {/* Summary */}
          <div style={{ animation: "fadeInUp 0.3s ease both" }}>
            {displaySummary ? (
              <SummaryNotes summary={displaySummary} highlight={highlightQuery} />
            ) : (
              <p className="text-text-muted italic">{isProcessing ? "Analyzing transcript..." : "No notes available"}</p>
            )}
          </div>

          <div className="h-px bg-border-subtle my-8" />

          {/* Key Decisions */}
          {decisions.length > 0 && (
            <div style={{ animation: "fadeInUp 0.3s ease both", animationDelay: "100ms" }}>
              <div className="flex items-center gap-2 mb-4 border-l-2 border-accent-purple pl-3">
                <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">Key Decisions</span>
                <span className="text-xs text-text-muted ml-1">({decisions.length})</span>
              </div>
              <div className="flex flex-col gap-3">
                {decisions.map((d: { id: string; decision_text: string }) => {
                  const text = typeof d.decision_text === "string"
                    ? d.decision_text
                    : typeof d.decision_text === "object" && d.decision_text !== null
                      ? (d.decision_text as unknown as { decision?: string }).decision || JSON.stringify(d.decision_text)
                      : String(d.decision_text || "");
                  const isEditingDecision = editingDecisionId === d.id;
                  return (
                  <div key={d.id} className="flex items-start gap-3 pl-3 group/dec">
                    <div className="w-[4px] h-[4px] rounded-sm bg-accent-purple mt-2.5 flex-shrink-0" />
                    {isEditingDecision ? (
                      <input
                        autoFocus
                        value={editingDecisionValue}
                        onChange={(e) => setEditingDecisionValue(e.target.value)}
                        onBlur={saveEditDecision}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEditDecision(); if (e.key === "Escape") setEditingDecisionId(null); }}
                        className="flex-1 text-text-primary text-[14px] leading-[1.65] font-medium bg-bg-surface border border-accent-primary rounded px-2 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <span
                        className="text-text-primary text-[14px] leading-[1.65] font-medium cursor-pointer hover:text-accent-primary transition-colors"
                        onClick={() => startEditDecision(d.id, text)}
                      >{text}</span>
                    )}
                  </div>
                  );
                })}
              </div>
              <div className="h-px bg-border-subtle my-8" />
            </div>
          )}

          {/* Key Topics */}
          {meeting.keyTopics && meeting.keyTopics.length > 0 && (
            <div style={{ animation: "fadeInUp 0.3s ease both", animationDelay: "150ms" }}>
              <div className="flex items-center gap-2 mb-3 border-l-2 border-accent-orange pl-3">
                <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">Key Topics</span>
              </div>
              <div className="flex flex-wrap gap-2 pl-3">
                {meeting.keyTopics.map((topic, i) => (
                  <span key={i} className="text-sm bg-bg-elevated text-text-secondary px-3 py-1.5 rounded-full border border-border-subtle">{topic}</span>
                ))}
              </div>
              <div className="h-px bg-border-subtle my-8" />
            </div>
          )}

          {/* Risks */}
          {meeting.risks && meeting.risks.length > 0 && (
            <div style={{ animation: "fadeInUp 0.3s ease both", animationDelay: "200ms" }}>
              <div className="flex items-center gap-2 mb-4 border-l-2 border-error pl-3">
                <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">Risks & Blockers</span>
              </div>
              <div className="flex flex-col gap-3 pl-3">
                {meeting.risks.map((r, i) => (
                  <div key={i} className="bg-error-muted/30 border border-error/10 rounded-xl px-4 py-3">
                    <p className="text-text-primary text-sm font-medium">{r.risk}</p>
                    {r.mitigation && r.mitigation !== "No mitigation discussed" && (
                      <p className="text-text-muted text-xs mt-1"><span className="font-semibold">Mitigation:</span> {r.mitigation}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="h-px bg-border-subtle my-8" />
            </div>
          )}

          {/* Follow-ups */}
          {meeting.followUps && meeting.followUps.length > 0 && (
            <div style={{ animation: "fadeInUp 0.3s ease both", animationDelay: "250ms" }}>
              <div className="flex items-center gap-2 mb-4 border-l-2 border-warning pl-3">
                <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">Open Questions</span>
              </div>
              <ul className="flex flex-col gap-2 pl-3">
                {meeting.followUps.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-warning text-sm mt-0.5">?</span>
                    <span className="text-text-secondary text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* === ACTIONS TAB === */}
      {activeTab === "actions" && (
        <div>
          {actionItems.length > 0 ? (
            <div className="flex flex-col">
              {actionItems.map((item: { id: string; owner_name: string; task_description: string; due_date: string | null; is_completed?: boolean }) => {
                const priority = inferPriority(item.task_description, item.due_date);
                const isEditing = editingItemId === item.id;
                return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 py-3 px-3 rounded-lg transition-all duration-200 group border-b border-border-subtle last:border-b-0 ${isEditing ? "bg-bg-elevated/60" : "hover:bg-bg-elevated/40 cursor-pointer"}`}
                >
                  <button
                    type="button"
                    aria-label={item.is_completed ? `Mark "${item.task_description}" as not done` : `Mark "${item.task_description}" as done`}
                    aria-pressed={item.is_completed}
                    disabled={pendingItems.has(item.id)}
                    className="w-[18px] h-[18px] rounded border-[2px] flex items-center justify-center flex-shrink-0 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                    style={{
                      borderColor: item.is_completed ? "var(--color-success)" : "var(--color-border-default)",
                      backgroundColor: item.is_completed ? "var(--color-success)" : "transparent",
                    }}
                    onClick={() => toggleItem(item.id)}
                  >
                    {item.is_completed && (
                      <svg className="w-3 h-3 text-text-inverse" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    )}
                  </button>
                  {isEditing && editingItemField === "owner" ? (
                    <input
                      autoFocus
                      value={editingItemValue}
                      onChange={(e) => setEditingItemValue(e.target.value)}
                      onBlur={saveEditItem}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEditItem(); if (e.key === "Escape") setEditingItemId(null); }}
                      className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-bg-surface border border-accent-primary text-text-primary focus:outline-none w-24"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-sm flex-shrink-0 cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: "var(--color-accent-purple-muted)", color: "var(--color-accent-purple)" }}
                      onClick={(e) => { e.stopPropagation(); startEditItem(item.id, "owner", item.owner_name); }}
                    >
                      {item.owner_name}
                    </span>
                  )}
                  {priority && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 uppercase tracking-wider"
                      style={{
                        backgroundColor: priority === "critical" ? "var(--color-error-muted)" : priority === "high" ? "var(--color-warning-muted)" : "var(--color-accent-muted)",
                        color: priority === "critical" ? "var(--color-error)" : priority === "high" ? "var(--color-warning)" : "var(--color-accent-primary)",
                      }}
                    >{priority}</span>
                  )}
                  {isEditing && editingItemField === "task" ? (
                    <input
                      autoFocus
                      value={editingItemValue}
                      onChange={(e) => setEditingItemValue(e.target.value)}
                      onBlur={saveEditItem}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEditItem(); if (e.key === "Escape") setEditingItemId(null); }}
                      className="flex-1 text-[14px] bg-bg-surface border border-accent-primary text-text-primary rounded px-2 py-0.5 focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="flex-1 text-[14px] transition-all duration-200 cursor-pointer"
                      style={{ color: item.is_completed ? "var(--color-text-muted)" : "var(--color-text-primary)", textDecoration: item.is_completed ? "line-through" : "none" }}
                      onClick={(e) => { e.stopPropagation(); if (!item.is_completed) startEditItem(item.id, "task", item.task_description); }}
                    >{item.task_description}</span>
                  )}
                  {isEditing && editingItemField === "dueDate" ? (
                    <input
                      autoFocus
                      type="date"
                      value={editingItemValue}
                      onChange={(e) => setEditingItemValue(e.target.value)}
                      onBlur={saveEditItem}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEditItem(); if (e.key === "Escape") setEditingItemId(null); }}
                      className="text-xs font-mono bg-bg-surface border border-accent-primary text-text-primary rounded px-2 py-0.5 focus:outline-none w-32"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="text-xs font-mono flex-shrink-0 cursor-pointer hover:text-accent-primary"
                      style={{ color: item.is_completed ? "var(--color-success)" : "var(--color-text-muted)" }}
                      onClick={(e) => { e.stopPropagation(); if (!item.is_completed) startEditItem(item.id, "dueDate", item.due_date || ""); }}
                    >{item.due_date ? formatShortDate(item.due_date) : "No deadline"}</span>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <p className="text-text-muted italic">No action items recorded</p>
          )}
          {completedCount === actionItems.length && actionItems.length > 0 && (
            <div className="mt-6 text-center py-4 rounded-xl bg-success-muted border border-success/20 text-success text-sm font-medium">
              All action items completed!
            </div>
          )}
        </div>
      )}

      {/* === TRANSCRIPT TAB === */}
      {activeTab === "transcript" && (
        <div>
          {meeting.audio_url && (
            <div className="mb-6">
              <AudioPlayer
                src={meeting.audio_url}
                segments={meeting.transcript_segments?.map((s) => ({
                  text: s.text,
                  speaker: s.speaker || undefined,
                  start_time: s.start_time ?? undefined,
                  end_time: s.end_time || undefined,
                }))}
              />
            </div>
          )}
          {meeting.raw_transcript && meeting.raw_transcript.length > 100 ? (
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
              {meeting.transcript_segments && meeting.transcript_segments.length > 1 ? (
                <InteractiveTranscript segments={meeting.transcript_segments} />
              ) : isDiarizing ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
                  <p className="text-text-secondary text-sm">Identifying speakers...</p>
                  <p className="text-text-muted text-xs">This may take a moment for long transcripts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {meeting.raw_transcript
                    .split(/(?<=[.!?])\s+/)
                    .filter((s) => s.trim().length > 5)
                    .map((sentence, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-accent-primary text-xs mt-1.5 flex-shrink-0">•</span>
                        <span className="text-text-secondary text-[13px] leading-relaxed font-mono">
                          {sentence.trim()}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-text-muted italic">No transcript available</p>
          )}
        </div>
      )}

      <div className="h-px bg-border-subtle my-6" />

      {/* Bottom Actions */}
      <div className="flex items-center justify-center flex-wrap gap-2 pb-8">
        <button
          onClick={async () => {
            if (!meeting) return;
            const text = copyShareFormat(meeting);
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              showToastFor("Copied to clipboard");
              setTimeout(() => setCopied(false), 2500);
            } catch {
              setError("Could not copy to clipboard.");
            }
          }}
          className="flex items-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150"
        >
          <Clipboard className="w-3.5 h-3.5" />
          Copy for Slack
        </button>
        <button
          onClick={() => { if (meeting) downloadAsMarkdown(meeting); }}
          className="flex items-center gap-2 border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-elevated px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150"
        >
          <Download className="w-3.5 h-3.5" />
          Markdown
        </button>
        <button
          onClick={() => { if (meeting) exportToPDF(meeting); }}
          className="flex items-center gap-2 border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-elevated px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150"
        >
          <FileText className="w-3.5 h-3.5" />
          PDF
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 text-text-muted hover:text-text-primary px-3 py-2 text-sm transition-colors duration-150"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>

      {/* Share Popover */}
      {showShareLink && (
        <div
          className="fixed bottom-24 right-8 w-72 bg-bg-elevated border border-border-default rounded-xl px-5 py-4 shadow-2xl z-50"
          style={{ animation: "fadeInUp 0.2s ease both" }}
        >
          <p className="text-xs text-text-muted mb-2">Share link</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary font-mono truncate flex-1">
              {window.location.origin}/share/{meeting.share_token || "..."}
            </span>
            {copied && (
              <span className="text-xs text-success font-medium flex items-center gap-1 flex-shrink-0">
                <Check className="w-3 h-3" /> Copied!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div
          className="fixed bottom-24 right-8 bg-bg-elevated border border-border-default rounded-xl px-5 py-3 shadow-xl z-50"
          style={{ animation: "fadeInUp 0.2s ease both" }}
          onClick={() => setShowToast(null)}
        >
          <span className="text-sm text-text-primary">{showToast}</span>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function SummaryNotes({ summary, highlight }: { summary: string; highlight?: string }) {
  const sections = parseSummaryIntoSections(summary);
  const defaultOpen = sections.length <= 4;
  // null means "not yet touched", so the first click always flips the section
  const [expanded, setExpanded] = useState<Record<number, boolean | null>>({});
  const isOpenAt = (i: number) => expanded[i] ?? defaultOpen;
  const allExpanded = sections.every((_, i) => isOpenAt(i));

  const toggleAll = () => {
    setExpanded(Object.fromEntries(sections.map((_, i) => [i, !allExpanded])));
  };

  const toggle = (i: number) => {
    setExpanded((prev) => ({ ...prev, [i]: !(prev[i] ?? defaultOpen) }));
  };

  if (sections.length <= 1) {
    return (
      <div className="space-y-2">
        {summary.split("\n").filter(Boolean).map((line, i) => (
          <div key={i} className="flex items-start gap-3 bg-bg-surface border border-border-subtle rounded-xl px-4 py-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-primary mt-2 flex-shrink-0" />
            <p className="text-text-primary text-[14px] leading-[1.65]">
              <HighlightText text={line} query={highlight} />
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={toggleAll}
        className="text-xs text-accent-primary hover:text-accent-primary-hover transition-colors mb-2 font-medium"
      >
        {allExpanded ? "Collapse all" : "Expand all"}
      </button>
      {sections.map((section, i) => {
        const isOpen = isOpenAt(i);
        return (
          <div
            key={i}
            className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden"
            style={{ animation: `fadeInUp 0.3s ease ${i * 0.05}s both` }}
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-elevated/40 transition-colors"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-text-inverse"
                style={{ background: section.color }}
              >
                {i + 1}
              </div>
              <span className="text-sm font-semibold text-text-primary flex-1">
                <HighlightText text={section.heading} query={highlight} />
              </span>
              <span className={`text-text-muted text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-3 pl-13">
                <ul className="space-y-1.5">
                  {section.points.map((point, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className="text-accent-primary text-xs mt-1">•</span>
                      <span className="text-text-secondary text-[13px] leading-relaxed">
                        <HighlightText text={point} query={highlight} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function parseSummaryIntoSections(summary: string): Array<{ heading: string; points: string[]; color: string }> {
  const colors = [
    "var(--color-cat-1)",
    "var(--color-cat-2)",
    "var(--color-cat-3)",
    "var(--color-cat-4)",
    "var(--color-cat-5)",
    "var(--color-cat-6)",
  ];

  const lines = summary.split("\n").filter((l) => l.trim());
  const sections: Array<{ heading: string; points: string[]; color: string }> = [];
  let current: { heading: string; points: string[]; color: string } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeader = /^#{1,3}\s/.test(trimmed) || /^\*\*[^*]+\*\*:?\s*$/.test(trimmed) || /^[A-Z][A-Za-z\s]+:$/.test(trimmed);

    if (isHeader) {
      if (current) sections.push(current);
      const heading = trimmed.replace(/^#{1,3}\s*/, "").replace(/^\*\*/, "").replace(/\*\*:?\s*$/, "").replace(/:\s*$/, "").trim();
      current = { heading, points: [], color: colors[sections.length % colors.length] };
    } else {
      const point = trimmed.replace(/^[-•]\s+/, "").replace(/^\*\s+/, "").replace(/^\d+\.\s*/, "").trim();
      if (!current) {
        current = { heading: "Overview", points: [], color: colors[0] };
      }
      if (point) current.points.push(point);
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0 && summary.trim()) {
    const sentences = summary.split(/(?<=[.!?])\s+/).filter((s) => s.length > 15);
    const chunks: string[][] = [];
    for (let i = 0; i < sentences.length; i += 3) {
      chunks.push(sentences.slice(i, i + 3));
    }
    const headings = ["Overview", "Key Points", "Details", "Additional Notes"];
    return chunks.map((chunk, i) => ({
      heading: headings[i] || `Section ${i + 1}`,
      points: chunk.map((s) => s.trim()),
      color: colors[i % colors.length],
    }));
  }

  return sections;
}

function inferPriority(task: string, dueDate: string | null): "critical" | "high" | "medium" | null {
  const lower = task.toLowerCase();
  if (/\b(urgent|critical|asap|immediately|blocker|p0|emergency)\b/i.test(lower)) return "critical";
  if (/\b(high priority|important|this week|by friday|deadline)\b/i.test(lower)) return "high";
  const remaining = daysUntil(dueDate);
  if (remaining !== null) {
    if (remaining <= 2) return "critical";
    if (remaining <= 7) return "high";
  }
  return null;
}

function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query || query.length < 2) return <>{text}</>;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-warning/30 text-text-primary rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
