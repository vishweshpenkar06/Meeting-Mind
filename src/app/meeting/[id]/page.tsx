"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  Clipboard,
  Download,
} from "lucide-react";
import { exportToPDF, downloadAsText, downloadAsMarkdown, copyShareFormat } from "@/lib/exports";
import AudioPlayer from "@/components/AudioPlayer";

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
  const [toggling, setToggling] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [showToast, setShowToast] = useState<string | null>(null);
  const [requestedAnalysis, setRequestedAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const fetchMeeting = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${params.id}`);
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
                    onClick={() => { if (meeting) downloadAsText(meeting); setShowMenu(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface/50 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Export Text
                  </button>
                  <button
                    onClick={() => { if (meeting) exportToPDF(meeting); setShowMenu(false); }}
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

      {/* Audio Player */}
      {meeting.audio_url && (
        <div style={{ animation: "fadeInUp 0.3s ease both" }}>
          <div className="flex items-center gap-2 mb-3 border-l-2 border-accent-orange pl-3">
            <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Recording
            </span>
          </div>
          <AudioPlayer
            src={meeting.audio_url}
            segments={meeting.transcript_segments?.map((s) => ({
              text: s.text,
              speaker: s.speaker || undefined,
              start_time: s.start_time || undefined,
              end_time: s.end_time || undefined,
            }))}
          />
        </div>
      )}

      {meeting.audio_url && <div className="h-px bg-border-subtle my-8" />}

      {/* Transcript with Speakers */}
      {meeting.raw_transcript && meeting.raw_transcript.length > 100 && (
        <div style={{ animation: "fadeInUp 0.3s ease both" }}>
          <details className="group">
            <summary className="flex items-center gap-2 mb-3 border-l-2 border-accent-purple pl-3 cursor-pointer list-none">
              <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
                Full Transcript
              </span>
              <span className="text-xs text-text-muted ml-1">
                ({meeting.raw_transcript.split(/\s+/).length} words)
              </span>
              <span className="text-text-muted text-xs ml-auto group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5 max-h-96 overflow-y-auto">
              {meeting.transcript_segments && meeting.transcript_segments.length > 0 ? (
                <div className="space-y-3">
                  {meeting.transcript_segments.map((seg) => (
                    <div key={seg.id} className="flex gap-3">
                      {seg.speaker && (
                        <span className="text-xs font-semibold text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded flex-shrink-0 h-fit">
                          {seg.speaker}
                        </span>
                      )}
                      <p className="text-text-primary text-sm leading-relaxed">{seg.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap font-[family:var(--font-jetbrains)]" style={{ fontSize: "13px" }}>
                  {meeting.raw_transcript}
                </p>
              )}
            </div>
          </details>
        </div>
      )}

      {meeting.raw_transcript && meeting.raw_transcript.length > 100 && <div className="h-px bg-border-subtle my-8" />}

      {/* Summary */}
      <div style={{ animation: "fadeInUp 0.3s ease both" }}>
        <div className="flex items-center gap-2 mb-3 border-l-2 border-accent-primary pl-3">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Meeting Notes
          </span>
          {isProcessing && <Loader2 className="w-3.5 h-3.5 text-accent-primary animate-spin" />}
        </div>
        {displaySummary ? (
          <SummaryNotes summary={displaySummary} highlight={highlightQuery} />
        ) : (
          <p className="text-text-muted italic">{isProcessing ? "Analyzing transcript..." : "No notes available"}</p>
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
          <div className="flex flex-col gap-4">
            {decisions.map((d: { id: string; decision_text: string }) => {
              const text = typeof d.decision_text === "string"
                ? d.decision_text
                : typeof d.decision_text === "object" && d.decision_text !== null
                  ? (d.decision_text as unknown as { decision?: string }).decision || JSON.stringify(d.decision_text)
                  : String(d.decision_text || "");
              return (
              <div key={d.id} className="pl-3">
                <div className="flex items-start gap-3">
                  <div className="w-[4px] h-[4px] rounded-sm bg-accent-purple mt-2.5 flex-shrink-0" />
                  <span className="text-text-primary text-[14px] leading-[1.65] font-medium">{text}</span>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <p className="text-text-muted italic pl-3">No decisions recorded</p>
        )}
      </div>

      <div className="h-px bg-border-subtle my-8" />

      {/* Key Topics */}
      {meeting.keyTopics && meeting.keyTopics.length > 0 && (
        <div style={{ animation: "fadeInUp 0.3s ease both", animationDelay: "150ms" }}>
          <div className="flex items-center gap-2 mb-3 border-l-2 border-accent-orange pl-3">
            <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Key Topics
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pl-3">
            {meeting.keyTopics.map((topic, i) => (
              <span key={i} className="text-sm bg-bg-elevated text-text-secondary px-3 py-1.5 rounded-full border border-border-subtle">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {meeting.keyTopics && meeting.keyTopics.length > 0 && <div className="h-px bg-border-subtle my-8" />}

      {/* Risks & Blockers */}
      {meeting.risks && meeting.risks.length > 0 && (
        <div style={{ animation: "fadeInUp 0.3s ease both", animationDelay: "200ms" }}>
          <div className="flex items-center gap-2 mb-4 border-l-2 border-error pl-3">
            <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Risks & Blockers
            </span>
            <span className="text-xs text-text-muted ml-1">({meeting.risks.length})</span>
          </div>
          <div className="flex flex-col gap-3 pl-3">
            {meeting.risks.map((r, i) => (
              <div key={i} className="bg-error-muted/30 border border-error/10 rounded-xl px-4 py-3">
                <p className="text-text-primary text-sm font-medium">{r.risk}</p>
                {r.mitigation && r.mitigation !== "No mitigation discussed" && (
                  <p className="text-text-muted text-xs mt-1">
                    <span className="font-semibold">Mitigation:</span> {r.mitigation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {meeting.risks && meeting.risks.length > 0 && <div className="h-px bg-border-subtle my-8" />}

      {/* Follow-ups */}
      {meeting.followUps && meeting.followUps.length > 0 && (
        <div style={{ animation: "fadeInUp 0.3s ease both", animationDelay: "250ms" }}>
          <div className="flex items-center gap-2 mb-4 border-l-2 border-warning pl-3">
            <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Open Questions & Follow-ups
            </span>
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

      {meeting.followUps && meeting.followUps.length > 0 && <div className="h-px bg-border-subtle my-8" />}

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
            {actionItems.map((item: { id: string; owner_name: string; task_description: string; due_date: string | null; is_completed?: boolean }) => {
              const priority = inferPriority(item.task_description, item.due_date);
              return (
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

                {priority && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 uppercase tracking-wider"
                    style={{
                      backgroundColor: priority === "critical" ? "rgba(239,68,68,0.15)" : priority === "high" ? "rgba(245,158,11,0.15)" : "rgba(79,142,247,0.1)",
                      color: priority === "critical" ? "#EF4444" : priority === "high" ? "#F59E0B" : "#4F8EF7",
                    }}
                  >
                    {priority}
                  </span>
                )}

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
              );
            })}
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
      <div className="flex items-center justify-center flex-wrap gap-3 pb-8">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-elevated px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all"
        >
          <Share2 className="w-4 h-4" />
          Share Link
        </button>
        <button
          onClick={() => {
            if (!meeting) return;
            const text = copyShareFormat(meeting);
            navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setShowToast("Copied to clipboard — paste into Slack or email");
              setTimeout(() => { setCopied(false); setShowToast(null); }, 2500);
            });
          }}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all"
        >
          <Clipboard className="w-4 h-4" />
          Copy for Slack
        </button>
        <button
          onClick={() => { if (meeting) downloadAsMarkdown(meeting); }}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all"
        >
          <Download className="w-4 h-4" />
          Export Markdown
        </button>
        <button
          onClick={() => { if (meeting) downloadAsText(meeting); }}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all"
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

function SummaryNotes({ summary, highlight }: { summary: string; highlight?: string }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const sections = parseSummaryIntoSections(summary);
  const allExpanded = Object.values(expanded).every(Boolean);

  const toggleAll = () => {
    if (allExpanded) {
      setExpanded({});
    } else {
      const next: Record<number, boolean> = {};
      sections.forEach((_, i) => { next[i] = true; });
      setExpanded(next);
    }
  };

  const toggle = (i: number) => {
    setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));
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
        const isOpen = expanded[i] ?? (sections.length <= 4);
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
  const colors = ["#4F8EF7", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

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
      const point = trimmed.replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, "").trim();
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
  if (dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    const daysUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntil <= 2) return "critical";
    if (daysUntil <= 7) return "high";
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
