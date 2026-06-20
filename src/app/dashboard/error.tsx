"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          Dashboard Error
        </h1>
        <p className="text-text-muted text-sm mb-6">
          Failed to load the dashboard. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-accent-primary text-white rounded-[10px] text-sm font-medium hover:bg-accent-primary-hover transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
