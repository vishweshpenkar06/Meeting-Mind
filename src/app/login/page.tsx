"use client";

import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-6 relative overflow-hidden">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />

      <div className="relative z-10 text-center max-w-sm w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-text-inverse font-bold text-xl"
            style={{ background: "var(--gradient-hero)" }}
          >
            M
          </div>
          <span className="font-[family:var(--font-space-grotesk)] font-bold text-2xl text-text-primary">
            MeetingMind
          </span>
        </div>

        <h1 className="font-[family:var(--font-space-grotesk)] font-bold text-xl text-text-primary mb-3">
          Sign in to your workspace
        </h1>
        <p className="text-text-secondary mb-8 text-sm leading-relaxed">
          Your meetings and action items are private to your account.
        </p>

        {error && (
          <div className="mb-6 bg-error-muted border border-error/20 rounded-xl px-4 py-3 text-error text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex items-center justify-center gap-3 w-full bg-white text-gray-900 px-6 py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>

        <Link
          href="/"
          className="inline-block mt-8 text-text-muted hover:text-text-secondary text-sm transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
