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
      <nav className="flex items-center justify-between px-6 md:px-12 h-16 border-b border-border-subtle bg-bg-base/80 backdrop-blur-xl sticky top-0 z-40">
        <a href="/dashboard" className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-text-inverse font-bold text-sm"
            style={{ background: "var(--gradient-hero)" }}
          >
            M
          </div>
          <span className="font-[family:var(--font-syne)] font-bold text-lg text-text-primary">
            MeetingMind
          </span>
        </a>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-xs text-text-muted hidden md:block max-w-[200px] truncate">
              {user.email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs text-text-muted hover:text-text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-bg-elevated/50"
          >
            Sign out
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}
