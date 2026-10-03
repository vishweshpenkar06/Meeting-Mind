"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Clock, Search, X } from "lucide-react";
import { speakerColor } from "@/lib/palette";

interface TranscriptSegment {
  id: string;
  text: string;
  speaker: string | null;
  start_time: number | null;
  end_time: number | null;
}

interface GroupedSegment {
  speaker: string;
  messages: Array<{
    id: string;
    text: string;
    start_time: number | null;
    end_time: number | null;
  }>;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function groupBySpeaker(segments: TranscriptSegment[]): GroupedSegment[] {
  const groups: GroupedSegment[] = [];

  for (const seg of segments) {
    const speaker = seg.speaker || "Unknown Speaker";
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.speaker === speaker) {
      lastGroup.messages.push({
        id: seg.id,
        text: seg.text,
        start_time: seg.start_time,
        end_time: seg.end_time,
      });
    } else {
      groups.push({
        speaker,
        messages: [{
          id: seg.id,
          text: seg.text,
          start_time: seg.start_time,
          end_time: seg.end_time,
        }],
      });
    }
  }

  return groups;
}

export default function InteractiveTranscript({ segments }: { segments: TranscriptSegment[] }) {
  // Keyed by a stable group identity, not an index, so search filtering cannot
  // reattach expansion state to the wrong speaker
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const grouped = useMemo(() => groupBySpeaker(segments), [segments]);
  const uniqueSpeakers = useMemo(() => [...new Set(segments.map((s) => s.speaker || "Unknown Speaker"))], [segments]);

  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase();
    return grouped
      .map((group) => ({
        ...group,
        messages: group.messages.filter((m) => m.text.toLowerCase().includes(q)),
      }))
      .filter((group) => group.messages.length > 0);
  }, [grouped, searchQuery]);

  const isGroupExpanded = (group: (typeof grouped)[number]) =>
    expandedGroups[`${group.speaker}::${group.messages[0]?.id ?? ""}`] ?? true;

  const toggleGroup = (group: (typeof grouped)[number]) => {
    const key = `${group.speaker}::${group.messages[0]?.id ?? ""}`;
    setExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    filteredGrouped.forEach((group) => {
      next[`${group.speaker}::${group.messages[0]?.id ?? ""}`] = value;
    });
    setExpandedGroups(next);
  };

  if (segments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted text-sm">No transcript segments available</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            {segments.length} segments &middot; {uniqueSpeakers.length} speaker{uniqueSpeakers.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            {uniqueSpeakers.map((speaker) => {
              const color = speakerColor(speaker);
              return (
                <span
                  key={speaker}
                  className="inline-flex items-center gap-1 text-caption font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: color.bg, color: color.solid, border: `1px solid ${color.border}` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.solid }} />
                  {speaker}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => showSearch ? setShowSearch(false) : setShowSearch(true)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title="Search transcript"
          >
            {showSearch ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setAll(true)}
            className="text-caption text-text-muted hover:text-accent-primary px-2 py-1 rounded transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={() => setAll(false)}
            className="text-caption text-text-muted hover:text-accent-primary px-2 py-1 rounded transition-colors"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="mb-3 px-1" style={{ animation: "fadeInUp 0.15s ease both" }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in transcript..."
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conversation thread */}
      <div className="space-y-4">
        {filteredGrouped.map((group, groupIndex) => {
          const color = speakerColor(group.speaker);
          const isExpanded = isGroupExpanded(group);
          const messageCount = group.messages.length;

          return (
            <div
              key={`${group.speaker}::${group.messages[0]?.id ?? groupIndex}`}
              className="rounded-xl overflow-hidden transition-all duration-200"
              style={{
                backgroundColor: color.bg,
                border: `1px solid ${color.border}`,
                animation: `fadeInUp 0.3s ease ${groupIndex * 0.03}s both`,
              }}
            >
              {/* Speaker header */}
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: color.solid, color: "var(--color-text-inverse)" }}
                >
                  {group.speaker.replace("Speaker ", "")}
                </div>
                <div className="flex-1 text-left">
                  <span className="text-sm font-semibold" style={{ color: color.solid }}>
                    {group.speaker}
                  </span>
                  <span className="text-xs text-text-muted ml-2">
                    {messageCount} {messageCount === 1 ? "message" : "messages"}
                  </span>
                </div>
                <span className="text-text-muted">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {/* Messages */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {group.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.02] transition-colors group/msg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary text-meta leading-relaxed whitespace-pre-wrap">
                          {searchQuery ? highlightText(msg.text, searchQuery) : msg.text}
                        </p>
                        {(msg.start_time !== null || msg.end_time !== null) && (
                          <div className="flex items-center gap-1.5 mt-1.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <Clock className="w-3 h-3 text-text-muted" />
                            <span className="text-caption text-text-muted font-mono">
                              {msg.start_time !== null ? formatTimestamp(msg.start_time) : "0:00"}
                              {msg.end_time !== null ? ` - ${formatTimestamp(msg.end_time)}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredGrouped.length === 0 && searchQuery && (
        <div className="text-center py-8">
          <p className="text-text-muted text-sm">No results for &ldquo;{searchQuery}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
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
