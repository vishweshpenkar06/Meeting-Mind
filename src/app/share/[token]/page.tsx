import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

async function getSharedMeeting(token: string) {
  const supabase = await createClient();
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select(
      `
      id,
      title,
      summary,
      created_at,
      action_items(*),
      key_decisions(*)
    `
    )
    .eq("share_token", token)
    .eq("is_public", true)
    .single();

  if (error || !meeting) return null;
  return meeting;
}

export default async function SharedMeetingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const meeting = await getSharedMeeting(token);

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base px-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-6 opacity-30">{"\u{1F50D}"}</div>
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            Meeting Not Found
          </h1>
          <p className="text-text-secondary">
            This meeting summary is no longer available.
          </p>
        </div>
      </div>
    );
  }

  const actionItems = meeting.action_items || [];
  const decisions = meeting.key_decisions || [];

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-[720px] mx-auto px-6 pt-12 pb-24">
        {/* Meeting Header */}
        <div className="mb-8">
          <h1 className="font-[family:var(--font-syne)] font-bold text-[28px] text-text-primary" style={{ lineHeight: "1.15" }}>
            {meeting.title}
          </h1>
          <p className="text-text-muted text-sm font-[family:var(--font-jetbrains)] mt-1">
            {new Date(meeting.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-purple-muted/50 text-accent-purple text-xs font-medium">
            {"\u{1F517}"} Shared with you
          </div>
        </div>

        <div className="h-px bg-border-subtle my-8" />

        {/* Summary */}
        {meeting.summary && (
          <>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3 border-l-2 border-accent-primary pl-3">
                <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
                  Summary
                </span>
              </div>
              <p className="text-text-primary text-[15px] leading-[1.7] whitespace-pre-wrap">
                {meeting.summary}
              </p>
            </div>
            <div className="h-px bg-border-subtle my-8" />
          </>
        )}

        {/* Key Decisions */}
        {decisions.length > 0 && (
          <>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 border-l-2 border-accent-purple pl-3">
                <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
                  Key Decisions
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {decisions.map((d: { id: string; decision_text: string }) => (
                  <li key={d.id} className="flex items-start gap-3 pl-3">
                    <div className="w-[4px] h-[4px] rounded-sm bg-accent-purple mt-2.5 flex-shrink-0" />
                    <span className="text-text-primary text-[14px] leading-[1.6]">
                      {d.decision_text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="h-px bg-border-subtle my-8" />
          </>
        )}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 border-l-2 border-success pl-3">
              <span className="text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
                Action Items
              </span>
            </div>
            <div className="flex flex-col">
              {actionItems.map(
                (item: { id: string; owner_name: string; task_description: string; due_date: string | null; is_completed: boolean }) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-3 px-2 border-b border-border-subtle"
                  >
                    <div
                      className="w-[18px] h-[18px] rounded border-2 flex-shrink-0"
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
                      className="flex-1 text-[14px]"
                      style={{ color: item.is_completed ? "#4A5E78" : "#EDF2FF" }}
                    >
                      {item.task_description}
                    </span>
                    <span className="text-xs font-[family:var(--font-jetbrains)] text-text-muted flex-shrink-0">
                      {item.due_date
                        ? new Date(item.due_date).toLocaleDateString()
                        : "No deadline"}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Branding */}
        <div className="text-center pt-8 border-t border-border-subtle">
          <p className="text-text-muted text-sm mb-3">
            Made with{" "}
            <span className="text-accent-primary font-medium">MeetingMind</span>
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-primary hover:underline transition-colors"
          >
            Get your own workspace {"\u2192"}
          </Link>
        </div>
      </div>
    </div>
  );
}
