import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="page-shell flex items-center justify-center">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-accent-primary animate-spin" />
        <span className="text-text-secondary text-sm">Loading...</span>
      </div>
    </div>
  );
}
