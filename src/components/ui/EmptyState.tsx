import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("text-center py-16 px-6", className)}>
      {icon && (
        <div className="w-14 h-14 rounded-full bg-bg-surface border border-border-subtle flex items-center justify-center mx-auto mb-4 text-text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-text-secondary font-semibold text-lg mb-1.5">{title}</h3>
      {description && <p className="text-text-muted text-sm max-w-sm mx-auto mb-5">{description}</p>}
      {action}
    </div>
  );
}

export interface SkeletonProps {
  className?: string;
  /** Matches the line-height of the text it stands in for */
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "h-3",
  md: "h-4",
  lg: "h-6",
};

export function Skeleton({ className, size = "md" }: SkeletonProps) {
  return <div aria-hidden="true" className={cn("skeleton", SIZES[size], className)} />;
}

/** Card-shaped placeholder whose geometry matches a meeting list row. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-bg-surface border border-border-subtle rounded-xl p-4", className)}>
      <Skeleton size="lg" className="w-1/3 mb-3" />
      <Skeleton className="w-full mb-2" />
      <Skeleton className="w-2/3" />
    </div>
  );
}

export default EmptyState;