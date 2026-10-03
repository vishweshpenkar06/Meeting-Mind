const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseDateOnly(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Postgres `date` columns arrive as "YYYY-MM-DD", which `new Date()` reads as UTC midnight.
 * Anything west of Greenwich then renders the previous day, so parse date-only values as local.
 */
export function formatLocalDate(value: string | null | undefined): string {
  if (!value) return "";
  const local = parseDateOnly(value);
  const date = local ?? new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "";
  const local = parseDateOnly(value);
  const date = local ?? new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

/** Whole calendar days from today to `value`; negative when overdue. */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const local = parseDateOnly(value);
  const date = local ?? new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / MS_PER_DAY);
}

/** "Today" / "Yesterday" / formatted date, compared by calendar day rather than elapsed hours. */
export function relativeDayLabel(value: string | null | undefined): string {
  const diff = daysUntil(value);
  if (diff === null) return "";
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  return formatShortDate(value);
}

/** Normalizes any parseable date to the "YYYY-MM-DD" shape Postgres `date` columns expect. */
export function toDateOnly(value: string): string {
  const local = parseDateOnly(value);
  const date = local ?? new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
