import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover affordance — only for cards that are themselves clickable */
  interactive?: boolean;
  padded?: boolean;
  children?: ReactNode;
}

export function Card({ interactive = false, padded = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-bg-surface border border-border-subtle rounded-xl",
        "shadow-[var(--shadow-sm)] shadow-[var(--shadow-inset)]",
        padded && "p-4",
        interactive &&
          "cursor-pointer transition-colors duration-150 hover:border-border-default hover:bg-bg-elevated/40 active:bg-bg-elevated",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-sm font-semibold text-text-primary", className)} {...props}>
      {children}
    </h3>
  );
}

export default Card;