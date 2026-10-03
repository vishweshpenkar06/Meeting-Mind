"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getUser().then(async ({ user: authUser }) => {
      if (!authUser || cancelled) return;
      const supabase = createClient();
      const result = await supabase
        .from("profiles")
        .select("email, name")
        .eq("id", authUser.id)
        .single();
      if (cancelled) return;
      const profile = result.data as { email?: string; name?: string } | null;
      setUser({ email: profile?.email || authUser.email || "", id: authUser.id });
    });

    return () => { cancelled = true; };
  }, []);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign-out error:", error.message);
        setSigningOut(false);
        return;
      }
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Sign-out failed:", err);
      setSigningOut(false);
    }
  };

  return (
    <div className="page-shell">
      <nav className="flex items-center justify-between px-6 h-14 border-b border-border-subtle bg-bg-base/80 backdrop-blur-xl sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-inverse font-bold text-xs"
            style={{ background: "var(--gradient-hero)" }}
          >
            M
          </div>
          <span className="font-display font-semibold text-sm text-text-primary">
            MeetingMind
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-caption text-text-muted hidden md:block max-w-45 truncate font-mono">
              {user.email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-caption text-text-muted hover:text-text-primary transition-colors px-2.5 py-1 rounded-lg hover:bg-bg-elevated/50 disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}
