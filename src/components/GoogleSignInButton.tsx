"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface GoogleSignInButtonProps {
  redirectTo?: string;
  variant?: "default" | "hero";
  className?: string;
}

export default function GoogleSignInButton({ redirectTo = "/dashboard", variant = "default", className }: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      console.error("Sign-in error:", error.message);
      setLoading(false);
    }
  };

  const isHero = variant === "hero";

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className={`flex items-center justify-center gap-3 font-semibold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
        isHero
          ? "px-8 py-4 rounded-xl text-text-inverse hover:opacity-90"
          : "w-full bg-white text-gray-900 px-6 py-3.5 rounded-xl hover:bg-gray-50"
      } ${className || ""}`}
      style={isHero ? { background: "var(--gradient-hero)" } : undefined}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      {loading ? "Redirecting..." : "Continue with Google"}
    </button>
  );
}
