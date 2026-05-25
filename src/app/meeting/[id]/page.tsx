"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Share2,
  Check,
  Link,
  FileDown,
  FileText,
  MoreHorizontal,
  Trash2,
  Loader2,
  Edit3,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { exportToPDF, downloadAsText } from "@/lib/exports";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { z } from "zod";

const MeetingSchema = z.object({
  title: z.string(),
  summary: z.string(),
  decisions: z.array(z.string()),
  actionItems: z.array(
    z.object({
      owner: z.string(),
      task: z.string(),
      dueDate: z.string().nullable(),
    })
  ),
});

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

interface Meeting {
  id: string;
  title: string;
  summary: string;
  created_at: string;
  share_token: string | null;
  is_public: boolean;
  action_items: ActionItem[];
  key_decisions: KeyDecision[];
  analysis_status?: string;
}

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  const { submit, object: partialMeeting, isLoading: isStreaming } = useObject({
    api: `/api/meetings/${params.id}/analyze-stream`,
    schema: MeetingSchema,
    onFinish: () => {
      // Refresh to get finalized data with real DB IDs
      fetchMeeting();
    }
  });

  const fetchMeeting = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setMeeting(data);
        setTitleValue(data.title || "");
        setError(null);
      } else {
        setError("Meeting not found or you don't have access");
      }
    } catch (err) {
      console.error("Failed to fetch meeting:", err);
      setError("Could not load meeting");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  useEffect(() => {
    if (meeting?.analysis_status === "processing" && !isStreaming) {
      submit({});
    }
  }, [meeting?.analysis_status, isStreaming, submit]);

  const toggleItem = async (actionItemId: string) => {
    if (!meeting || toggling) return;
    const item = meeting.action_items?.find((i) => i.id === actionItemId);
    if (!item) return;

    const newCompleted = !item.is_completed;
    setMeeting({
      ...meeting,
      action_items: meeting.action_items.map((i) =>
        i.id === actionItemId ? { ...i, is_completed: newCompleted } : i
      ),
    });

    setToggling(true);
    try {
      await fetch(`/api/meetings/${meeting.id}/action-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId, isCompleted: newCompleted }),
      });
    } catch {
      console.error("Failed to toggle");
      fetchMeeting();
    } finally {
      setToggling(false);
    }
  };

  const handleShare = async () => {
    if (!meeting) return;

    if (!meeting.share_token) {
      await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: true }),
      });
      await fetchMeeting();
    }

    const freshMeeting = await (await fetch(`/api/meetings/${meeting.id}`)).json();
    setMeeting(freshMeeting);

    const shareUrl = `${window.location.origin}/share/${freshMeeting.share_token || "..."}`;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setShowShareLink(true);
      setTimeout(() => {
        setCopied(false);
        setShowShareLink(false);
      }, 2000);
    });
  };

  const togglePublic = async () => {
    if (!meeting) return;
    await fetch(`/api/meetings/${meeting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: !meeting.is_public }),
    });
    await fetchMeeting();
    setShowToast(meeting.is_public ? "Meeting is now private" : "Meeting is now public");
  };

  const saveTitle = async () => {
    if (!meeting || !titleValue.trim()) return;
    const prevTitle = meeting.title;
    setMeeting({ ...meeting, title: titleValue.trim() });
    setEditTitle(false);
    try {
      await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleValue.trim() }),
      });
    } catch {
      setMeeting({ ...meeting, title: prevTitle });
    }
  };

  const exportAsText = () => {
    if (!meeting) return;
    setExporting(true);
    const actionItems = meeting.action_items || [];
    const decisions = meeting.key_decisions || [];
    const completedCount = actionItems.filter((a) => a.is_completed).length;

    let text = `${meeting.title}\n`;
    text += `${new Date(meeting.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}\n`;
    text += `${completedCount}/${actionItems.length} tasks completed\n\n`;

    if (meeting.summary) {
      text += "--- SUMMARY ---\n\n";
      text += `${meeting.summary}\n\n`;
    }

    if (decisions.length > 0) {
      text += "--- KEY DECISIONS ---\n\n";
      decisions.forEach((d) => {
        text += `- ${d.decision_text}\n`;
      });
      text += "\n";
    }

    if (actionItems.length > 0) {
      text += "--- ACTION ITEMS ---\n\n";
      actionItems.forEach((item) => {
        const done = item.is_completed ? "[x]" : "[ ]";
        const due = item.due_date ? ` (due ${new Date(item.due_date).toLocaleDateString()})` : "";
        text += `${done} [${item.owner_name}] ${item.task_description}${due}\n`;
      });
      text += "\n";
    }

    text += "---\nExported from MeetingMind";

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(meeting.title || "meeting").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const handleDelete = async () => {
    if (!meeting) return;
    try {
      await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch {
      console.error("Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen max-w-[720px] mx-auto px-6 pt-8 flex items-center justify-center bg-bg-base">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-accent-primary animate-spin" />
          <span className="text-text-secondary text-sm">Loading meeting...</span>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base px-6">
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

  const isProcessing = meeting.analysis_status === "processing" || isStreaming;
  
  // Use streamed data if processing, otherwise use DB data
  type PartialMeetingType = {
    title?: string;
    summary?: string;
    actionItems?: { owner?: string; task?: string; dueDate?: string | null }[];
    decisions?: string[];
  };
  const parsedMeeting = partialMeeting as PartialMeetingType | undefined;
  const displayTitle = isProcessing ? parsedMeeting?.title || meeting.title : meeting.title;
  const displaySummary = isProcessing ? parsedMeeting?.summary || "" : meeting.summary;
  
  // Map partial items to the same shape for rendering
  const actionItems = isProcessing 
    ? (parsedMeeting?.actionItems?.map((a: { owner?: string; task?: string; dueDate?: string | null } | undefined, i: number) => ({
        id: `temp-${i}`,
        owner_name: a?.owner || "Unassigned",
        task_description: a?.task || "...",
        due_date: a?.dueDate || null,
        is_completed: false
      })) || [])
    : (meeting.action_items || []);
    
  const decisions = isProcessing
    ? (parsedMeeting?.decisions?.map((d: string | undefined, i: number) => ({
        id: `temp-${i}`,
        decision_text: d || "..."
      })) || [])
    : (meeting.key_decisions || []);

  const completedCount = actionItems.filter((a: { is_completed?: boolean }) => a.is_completed).length;
  const progressPct = actionItems.length > 0 ? (completedCount / actionItems.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-bg-base max-w-[720px] mx-auto px-6 pt-8 pb-24">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium hover:bg-bg-elevated/50 px-3 py-2 rounded-lg -ml-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>

        <div className="flex items-center gap-2 relative">
          {/* Visibility toggle */}
          {meeting.share_token && (
            <button
              onClick={togglePublic}
              className="flex items-center gap-1.5 text-text-muted hover:text-accent-primary px-3 py-2 rounded-lg transition-colors text-xs"
              title={meeting.is_public ? "Make private" : "Make public"}
            >
              {meeting.is_public ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {meeting.is_public ? "Public" : "Private"}
            </button>
          )}

          <button
            onClick={handleShare}
            className="flex items-center gap-2 border border-border-default text-text-secondary hover:text-text-primary px-4 py-2 rounded-[10px] transition-all text-sm font-medium"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-success" />
                <span className="text-success">Copied!</span>
              </>
            ) : (
              <>
                <Link className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </button>

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-lg transition-all"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute top-full right-0 mt-2 w-52 bg-bg-elevated border border-border-default rounded-xl py-2 shadow-xl z-20"
                  style={{ animation: "fadeIn 0.15s ease both" }}>
                  <button
                    onClick={() => { setEditTitle(true); setShowMenu(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface/50 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Rename
                  </button>
                  <button
                    onClick={exportAsText}
                    disabled={exporting}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface/50 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" /> {exporting ? "Exporting..." : "Export Text"}
                  </button>
                  <button
                    onClick={() => { if (meeting) exportToPDF(meeting); }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface/50 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" /> Export PDF
                  </button>
                  <hr className="my-1.5 border-border-subtle" />
                  <button
                    onClick={() => { setShowMenu(false); handleDelete(); }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-error hover:bg-error-muted/50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Meeting
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
      <div className="mb-8" style={{ animation: "fadeIn 0.3s ease both" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="font-[family:var(--font-syne)] font-bold text-[28px] text-text-primary"
              style={{ lineHeight: "1.15" }}
            >
              {displayTitle || "Untitled Meeting"}
              {isProcessing && <Loader2 className="w-5 h-5 inline-block ml-3 text-accent-primary animate-spin" />}
            </h1>
            <p className="text-text-muted text-sm font-[family:var(--font-jetbrains)] mt-1">
              {new Date(meeting.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {" \u00B7 "}
              {actionItems.length} {actionItems.length === 1 ? "task" : "tasks"}
              {" \u00B7 "}
              {decisions.length} {decisions.length === 1 ? "decision" : "decisions"}
            </p>
          </div>
          {completedCount < actionItems.length && actionItems.length > 0 && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-warning-muted text-warning mt-1">
              {actionItems.length - completedCount} pending
            </span>
          )}
        </div>

        {/* Progress */}
        {actionItems.length > 0 && (
          <>
            <div className="mt-4 h-1 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: progressPct === 100
                    ? "linear-gradient(90deg, #10B981, #34D399)"
                    : "var(--color-accent-primary)",
                }}
              />
            </div>
            <p className="text-xs text-text-secondary mt-1.5">
              {completedCount} of {actionItems.length} tasks completed
            </p>
          </>
        )}
      </div>

      <div className="h-px bg-border-subtle my-8" />

      {/* Summary */}
      <div style={{ animation: "fadeInUp 0.3s ease both" }}>
        <div className="flex items-center gap-2 mb-3 border-l-2 border-accent-primary pl-3">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Summary
          </span>
        </div>
        {displaySummary ? (
          <p className="text-text-primary text-[15px] leading-[1.75] whitespace-pre-wrap">
            {displaySummary}
            {isProcessing && <span className="inline-block w-2 h-4 bg-accent-primary animate-pulse ml-1 align-middle" />}
          </p>
        ) : (
          <p className="text-text-muted italic">{isProcessing ? "Analyzing transcript..." : "No summary available"}</p>
        )}
      </div>

      <div className="h-px bg-border-subtle my-8" />

      {/* Key Decisions */}
      <div style={{ animation: "fadeInUp 0.3s ease both", animationDelay: "100ms" }}>
        <div className="flex items-center gap-2 mb-4 border-l-2 border-accent-purple pl-3">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Key Decisions
          </span>
          {decisions.length > 0 && (
            <span className="text-xs text-text-muted ml-1">({decisions.length})</span>
          )}
        </div>
        {decisions.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {decisions.map((d: { id: string; decision_text: string }) => (
              <li key={d.id} className="flex items-start gap-3 pl-3">
                <div className="w-[4px] h-[4px] rounded-sm bg-accent-purple mt-2.5 flex-shrink-0" />
                <span className="text-text-primary text-[14px] leading-[1.65]">{d.decision_text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted italic pl-3">No decisions recorded</p>
        )}
      </div>

      <div className="h-px bg-border-subtle my-8" />

      {/* Action Items */}
      <div style={{ animation: "fadeInUp 0.3s ease both", animationDelay: "200ms" }}>
        <div className="flex items-center gap-2 mb-4 border-l-2 border-success pl-3">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Action Items
          </span>
          {actionItems.length > 0 && (
            <span className="text-xs text-text-muted ml-1">
              ({completedCount}/{actionItems.length} done)
            </span>
          )}
        </div>
        {actionItems.length > 0 ? (
          <div className="flex flex-col">
            {actionItems.map((item: { id: string; owner_name: string; task_description: string; due_date: string | null; is_completed?: boolean }) => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-bg-elevated/40 transition-all duration-200 cursor-pointer group"
                onClick={() => toggleItem(item.id)}
              >
                <div
                  className="w-[18px] h-[18px] rounded border-[2px] flex items-center justify-center flex-shrink-0 transition-all duration-200"
                  style={{
                    borderColor: item.is_completed ? "#34D399" : "#2A3F57",
                    backgroundColor: item.is_completed ? "#34D399" : "transparent",
                  }}
                >
                  {item.is_completed && (
                    <svg className="w-3 h-3 text-text-inverse" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  )}
                </div>

                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: "rgba(45, 31, 94, 0.6)", color: "#8B5CF6" }}
                >
                  {item.owner_name}
                </span>

                <span
                  className="flex-1 text-[14px] transition-all duration-200"
                  style={{
                    color: item.is_completed ? "#4A5E78" : "#EDF2FF",
                    textDecoration: item.is_completed ? "line-through" : "none",
                  }}
                >
                  {item.task_description}
                </span>

                <span
                  className="text-xs font-[family:var(--font-jetbrains)] flex-shrink-0"
                  style={{ color: item.is_completed ? "#34D399" : "#4A5E78" }}
                >
                  {item.due_date
                    ? new Date(item.due_date).toLocaleDateString()
                    : "No deadline"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted italic pl-3">No action items recorded</p>
        )}

        {/* All complete celebration */}
        {completedCount === actionItems.length && actionItems.length > 0 && (
          <div
            className="mt-6 text-center py-4 rounded-xl bg-success-muted border border-success/20 text-success text-sm font-medium"
            style={{ animation: "fadeInUp 0.3s ease both" }}
          >
            {"\u{1F389}"} All action items completed!
          </div>
        )}
      </div>

      <div className="h-px bg-border-subtle my-8" />

      {/* Bottom Actions */}
      <div className="flex items-center justify-center gap-4 pb-8">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-elevated px-5 py-2.5 rounded-[10px] text-sm font-medium transition-all"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
        <button
          onClick={() => { if (meeting) downloadAsText(meeting); }}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated px-5 py-2.5 rounded-[10px] text-sm font-medium transition-all"
        >
          <FileDown className="w-4 h-4" />
          Export Text
        </button>
        <button
          onClick={() => { if (meeting) exportToPDF(meeting); }}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated px-5 py-2.5 rounded-[10px] text-sm font-medium transition-all"
        >
          <FileText className="w-4 h-4" />
          Export PDF
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
