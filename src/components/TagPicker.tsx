"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface TagPickerProps {
  meetingId: string;
  className?: string;
}

/**
 * Assigns tags to a meeting. Renders nothing when the tags table is absent —
 * the schema is optional in this app, so a failure must not break the page.
 */
export function TagPicker({ meetingId, className }: TagPickerProps) {
  const [all, setAll] = useState<Tag[]>([]);
  const [assigned, setAssigned] = useState<Tag[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!meetingId) return;
    let cancelled = false;

    (async () => {
      try {
        const [allRes, mineRes] = await Promise.all([
          fetch("/api/tags"),
          fetch(`/api/tags?meetingId=${encodeURIComponent(meetingId)}`),
        ]);
        if (!allRes.ok) return;
        const allData = await allRes.json();
        if (cancelled) return;
        setAll(Array.isArray(allData.tags) ? allData.tags : []);

        if (mineRes.ok) {
          const mine = await mineRes.json();
          if (!cancelled && Array.isArray(mine.tags)) setAssigned(mine.tags);
        }
      } catch {
        // Non-fatal: tagging is an enhancement, not a requirement
      }
    })();

    return () => { cancelled = true; };
  }, [meetingId]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const assignedIds = new Set(assigned.map((t) => t.id));

  const addTag = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, meetingId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not add tag");
        return;
      }
      setAll((prev) => (prev.some((t) => t.id === data.id) ? prev : [...prev, data]));
      setAssigned((prev) => (prev.some((t) => t.id === data.id) ? prev : [...prev, data]));
      setDraft("");
      setAdding(false);
    } catch {
      setError("Could not add tag");
    } finally {
      setBusy(false);
    }
  };

  const removeTag = async (tagId: string) => {
    const removed = assigned.find((t) => t.id === tagId);
    setAssigned((prev) => prev.filter((t) => t.id !== tagId));
    setError(null);
    try {
      const res = await fetch(`/api/tags?tagId=${encodeURIComponent(tagId)}&meetingId=${encodeURIComponent(meetingId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // Roll back so the UI never claims a detach that did not persist
        if (removed) setAssigned((prev) => [...prev, removed]);
        setError("Could not remove tag");
      }
    } catch {
      if (removed) setAssigned((prev) => [...prev, removed]);
      setError("Could not remove tag");
    }
  };

  const available = all.filter((t) => !assignedIds.has(t.id));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <TagIcon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" aria-hidden="true" />

      {assigned.map((tag) => (
        <Badge key={tag.id} tone="primary" style={{ borderColor: `${tag.color}55`, color: tag.color, background: `${tag.color}1a` }}>
          {tag.name}
          <button
            type="button"
            onClick={() => removeTag(tag.id)}
            aria-label={`Remove tag ${tag.name}`}
            className="hover:opacity-100 opacity-70 transition-opacity"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </Badge>
      ))}

      {adding ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => !draft && setAdding(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addTag(draft); }
            if (e.key === "Escape") { setDraft(""); setAdding(false); }
          }}
          placeholder="Tag name"
          maxLength={40}
          disabled={busy}
          aria-label="New tag name"
          className="w-28 bg-bg-elevated border border-accent-primary rounded-full px-3 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-border-default text-[11px] text-text-muted hover:text-text-secondary hover:border-border-strong transition-colors"
        >
          <Plus className="w-3 h-3" aria-hidden="true" />
          Add tag
        </button>
      )}

      {available.length > 0 && !adding && (
        <select
          value=""
          onChange={(e) => e.target.value && addTag(available.find((t) => t.id === e.target.value)?.name || "")}
          aria-label="Apply an existing tag"
          className="bg-transparent border border-border-subtle rounded-full px-2 py-1 text-[11px] text-text-muted focus:outline-none focus:border-accent-primary cursor-pointer"
        >
          <option value="">Existing tags…</option>
          {available.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
      )}

      {error && <span role="alert" className="text-[11px] text-error">{error}</span>}
    </div>
  );
}

export default TagPicker;
