"use client";

import { useState } from "react";
import { ArrowRight, Star } from "lucide-react";

const features = [
  { icon: "\u{1F4DD}", title: "Smart Summary", desc: "AI condenses your meeting into key takeaways" },
  { icon: "\u{1F4CC}", title: "Key Decisions", desc: "Never forget what was decided" },
  { icon: "\u2705", title: "Action Items", desc: "Who does what, by when" },
  { icon: "\u{1F517}", title: "Shareable Links", desc: "Share meeting notes with one click" },
  { icon: "\u{1F4E4}", title: "Export Options", desc: "Download as PDF or plain text" },
  { icon: "\u{1F50D}", title: "Search & Filter", desc: "Find any meeting instantly" },
];

const testimonials = [
  { text: "Saved our team hours every week", name: "Rahul, PM", avatar: "R" },
  { text: "Action items never fell through the cracks", name: "Priya, Engineer", avatar: "P" },
  { text: "Best meeting tool I've used", name: "Aman, Founder", avatar: "A" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-bg-base">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-30"
          style={{
            background: "radial-gradient(ellipse, rgba(79,142,247,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="absolute top-[400px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 h-16 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-text-inverse font-bold text-sm"
            style={{
              background: "var(--gradient-hero)",
              boxShadow: "0 0 16px rgba(79,142,247,0.2)",
            }}
          >
            M
          </div>
          <span className="font-[family:var(--font-syne)] font-bold text-lg text-text-primary">
            MeetingMind
          </span>
        </div>
        <a
          href="/login"
          className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-200 flex items-center gap-1 px-4 py-2 rounded-lg hover:bg-bg-elevated/50"
        >
          Sign in
          <ArrowRight className="w-4 h-4" />
        </a>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center">
        {/* Badge */}
        <a href="#features" className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 hover:opacity-80 transition-opacity"
          style={{
            background: "rgba(45, 31, 94, 0.6)",
            color: "#8B5CF6",
          }}
        >
          <Star className="w-3 h-3" />
          <span className="text-xs font-semibold tracking-wide">AI-Powered Meeting Workspace</span>
        </a>

        {/* Heading */}
        <h1
          className="text-4xl md:text-5xl lg:text-[56px] leading-tight max-w-3xl font-[family:var(--font-syne)] font-extrabold tracking-tight mb-6"
          style={{ lineHeight: "1.05" }}
        >
          <span className="text-text-primary">Turn messy meetings</span> {" "}
          <br className="hidden sm:block" />
          <span className="text-text-muted">into</span>{" "}
          <span
            style={{
              backgroundImage: "var(--gradient-hero)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            clear action plans.
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-text-secondary text-base md:text-[17px] leading-relaxed max-w-xl mb-10">
          Upload a recording or paste a transcript. Get a structured summary,
          key decisions, and action items {"—"} instantly.
        </p>

        {/* CTA */}
        <a
          href="/login"
          className="flex items-center gap-2 px-8 py-4 rounded-[12px] text-text-inverse text-[15px] font-semibold transition-all duration-200 hover:opacity-90 hover:shadow-[0_0_30px_rgba(79,142,247,0.3)] hover:-translate-y-0.5"
          style={{
            background: "var(--gradient-hero)",
            boxShadow: "0 0 20px rgba(79,142,247,0.2)",
          }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Continue with Google</span>
        </a>

        <p className="text-text-muted text-sm mt-4">
          No credit card required {"\u00B7"} Free to start
        </p>
      </div>

      {/* Features */}
      <section id="features" className="relative z-10 px-6 pb-20 max-w-[1000px] mx-auto">
        <h2 className="text-center text-2xl md:text-3xl font-[family:var(--font-syne)] font-bold text-text-primary mb-12">
          Everything you need from a meeting
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group bg-bg-surface border border-border-subtle rounded-2xl p-6 hover:border-border-default hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 cursor-default"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="text-2xl mb-3 block">{f.icon}</span>
              <div className="text-sm font-semibold text-text-primary mb-1">
                {f.title}
              </div>
              <div className="text-xs text-text-secondary leading-relaxed">
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 px-6 pb-24 max-w-[800px] mx-auto">
        <h2 className="text-center text-xl font-[family:var(--font-syne)] font-bold text-text-primary mb-8">
          Loved by teams
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className="bg-bg-surface border border-border-subtle rounded-2xl p-5 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-text-inverse"
                  style={{ background: i === 0 ? "var(--gradient-hero)" : i === 1 ? "linear-gradient(135deg, #8B5CF6, #EC4899)" : "linear-gradient(135deg, #10B981, #3B82F6)" }}
                >
                  {t.avatar}
                </div>
                <span className="text-xs text-text-muted">{t.name}</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{"\""}{t.text}{"\""}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-subtle py-6 text-center">
        <p className="text-text-muted text-xs">
          {"\u00A9"} 2026 MeetingMind. Built with Next.js and OpenAI.
        </p>
      </footer>

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
