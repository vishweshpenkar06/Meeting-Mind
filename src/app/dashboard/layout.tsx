"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);

  useEffect(() => {
    getUser().then(async ({ user }) => {
      if (user) {
        const supabase = createClient();
        const result = await supabase
          .from("profiles")
          .select("email, name")
          .eq("id", user.id)
          .single();
        const profile = result.data as { email?: string; name?: string } | null;
        setUser({ email: profile?.email || user.email || "", id: user.id });
      }
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <nav className="flex items-center justify-between px-6 h-14 border-b border-border-subtle bg-bg-base/80 backdrop-blur-xl sticky top-0 z-40">
        <a href="/dashboard" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-inverse font-bold text-xs"
            style={{ background: "var(--gradient-hero)" }}
          >
            M
          </div>
          <span className="font-[family:var(--font-space-grotesk)] font-semibold text-sm text-text-primary">
            MeetingMind
          </span>
        </a>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-[11px] text-text-muted hidden md:block max-w-[180px] truncate font-[family:var(--font-jetbrains)]">
              {user.email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="text-[11px] text-text-muted hover:text-text-primary transition-colors px-2.5 py-1 rounded-lg hover:bg-bg-elevated/50"
          >
            Sign out
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}
