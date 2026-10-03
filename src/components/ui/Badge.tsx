import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "success" | "warning" | "error";

const TONES: Record<Tone, string> = {
  neutral: "bg-bg-elevated text-text-secondary border-border-default",
  primary: "bg-accent-muted text-accent-primary border-accent-primary/30",
  success: "bg-success-muted text-success border-success/30",
  warning: "bg-warning-muted text-warning border-warning/30",
  error: "bg-error-muted text-error border-error/30",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children?: ReactNode;
}

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium leading-none",
        TONES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;