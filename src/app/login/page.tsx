"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-6 relative overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />

      <div className="relative z-10 text-center max-w-sm w-full">
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

        <GoogleSignInButton redirectTo={redirectTo} />

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
