"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent-primary text-text-inverse hover:bg-accent-primary-hover active:bg-accent-primary-active disabled:hover:bg-accent-primary",
  secondary:
    "bg-bg-elevated text-text-primary border border-border-default hover:border-border-strong active:bg-bg-surface disabled:hover:border-border-default",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 active:bg-bg-elevated disabled:hover:bg-transparent",
  danger:
    "bg-error-muted text-error border border-error/30 hover:bg-error/20 active:bg-error/25 disabled:hover:bg-error-muted",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-meta gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-body gap-2 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Required when the button renders only an icon */
  iconOnly?: boolean;
  children?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, iconOnly = false, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        iconOnly && size === "sm" && "w-8 px-0",
        iconOnly && size === "md" && "w-10 px-0",
        iconOnly && size === "lg" && "w-12 px-0",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;