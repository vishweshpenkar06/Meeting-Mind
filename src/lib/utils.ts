export type ClassValue = string | number | false | null | undefined;

/**
 * Joins class names, dropping falsy values. Intentionally not `clsx` +
 * `tailwind-merge` — this app has no conflicting-utility case that needs
 * last-wins resolution, and two dependencies are not worth it.
 */
export function cn(...values: ClassValue[]): string {
  let out = "";
  for (const value of values) {
    if (!value) continue;
    out = out ? `${out} ${value}` : String(value);
  }
  return out;
}
