"use client";

import { ArrowRight, FileText, CheckCircle, Link2, Download, Search, Zap } from "lucide-react";
import GoogleSignInButton from "./GoogleSignInButton";

const features = [
  { icon: FileText, title: "Smart Summary", desc: "AI condenses your meeting into key takeaways" },
  { icon: Zap, title: "Key Decisions", desc: "Never forget what was decided" },
  { icon: CheckCircle, title: "Action Items", desc: "Who does what, by when" },
  { icon: Link2, title: "Shareable Links", desc: "Share meeting notes with one click" },
  { icon: Download, title: "Export Options", desc: "Download as PDF or plain text" },
  { icon: Search, title: "Search & Filter", desc: "Find any meeting instantly" },
];

export default function LandingPage() {
  return (
    <div className="page-shell relative overflow-hidden">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 h-16 page-container page-container-wide">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-text-inverse font-bold text-sm"
            style={{ background: "var(--gradient-hero)" }}
          >
            M
          </div>
          <span className="font-display font-bold text-lg text-text-primary">
            MeetingMind
          </span>
        </div>
        <a
          href="/login"
          className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 px-4 py-2 rounded-xl hover:bg-bg-elevated/50"
        >
          Sign in
          <ArrowRight className="w-4 h-4" />
        </a>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 bg-bg-elevated/60 border border-border-subtle">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
          <span className="text-xs font-medium text-text-secondary">AI-Powered Meeting Workspace</span>
        </div>

        {/* Heading */}
        <h1
          className="text-4xl md:text-5xl lg:text-[56px] leading-tight max-w-3xl font-display font-bold tracking-tight mb-6"
          style={{ lineHeight: "1.05" }}
        >
          <span className="text-text-primary">Turn messy meetings</span>{" "}
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
          key decisions, and action items instantly.
        </p>

        {/* CTA */}
        <div className="flex flex-col items-center gap-2">
          <GoogleSignInButton variant="hero" />
          <p className="text-text-muted text-sm mt-2">
            No credit card required
          </p>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="relative z-10 px-6 pb-20 page-container max-w-5xl">
        <h2 className="text-center text-2xl md:text-3xl font-display font-bold text-text-primary mb-12">
          Everything you need from a meeting
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group bg-bg-surface border border-border-subtle rounded-xl p-6 hover:border-border-default transition-all duration-150 cursor-default"
              >
                <Icon className="w-5 h-5 text-accent-primary mb-3" />
                <div className="text-sm font-semibold text-text-primary mb-1">
                  {f.title}
                </div>
                <div className="text-xs text-text-secondary leading-relaxed">
                  {f.desc}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-subtle py-6 text-center">
        <div className="flex items-center justify-center gap-4 text-text-muted text-xs">
          <span>2026 MeetingMind</span>
          <span className="text-border-default">|</span>
          <a href="/privacy" className="hover:text-text-secondary transition-colors">Privacy Policy</a>
          <span className="text-border-default">|</span>
          <a href="/terms" className="hover:text-text-secondary transition-colors">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
