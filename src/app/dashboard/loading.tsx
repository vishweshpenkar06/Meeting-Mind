import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-accent-primary animate-spin" />
        <span className="text-text-secondary text-sm">Loading dashboard...</span>
      </div>
    </div>
  );
}
