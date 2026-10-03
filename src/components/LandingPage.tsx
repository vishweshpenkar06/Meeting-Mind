"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileText,
  CheckCircle,
  Link2,
  Download,
  Search,
  Zap,
  Upload,
  Sparkles,
  ClipboardCheck,
} from "lucide-react";
import GoogleSignInButton from "./GoogleSignInButton";
import { Card } from "@/components/ui";

const features = [
  { icon: FileText, title: "Smart Summary", desc: "AI condenses your meeting into key takeaways" },
  { icon: Zap, title: "Key Decisions", desc: "Never forget what was decided" },
  { icon: CheckCircle, title: "Action Items", desc: "Who does what, by when" },
  { icon: Link2, title: "Shareable Links", desc: "Share meeting notes with one click" },
  { icon: Download, title: "Export Options", desc: "Download as PDF, Markdown, or plain text" },
  { icon: Search, title: "Search & Filter", desc: "Find any meeting by meaning, not keywords" },
];

const steps = [
  {
    icon: Upload,
    title: "Drop in a recording",
    desc: "Upload audio or video, record live in the browser, or paste an existing transcript.",
  },
  {
    icon: Sparkles,
    title: "AI structures it",
    desc: "Speakers are separated, decisions extracted, and every action item assigned an owner and due date.",
  },
  {
    icon: ClipboardCheck,
    title: "Act on it",
    desc: "Tick off tasks as they land, share a read-only link, or export to your team wiki.",
  },
];

export default function LandingPage() {
  return (
    <div className="page-shell relative overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none" aria-hidden="true" />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[420px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(79,142,247,0.14), transparent 70%)" }}
        aria-hidden="true"
      />

      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 h-16 page-container page-container-wide">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-text-inverse font-bold text-sm"
            style={{ background: "var(--gradient-hero)" }}
            aria-hidden="true"
          >
            M
          </div>
          <span className="font-display font-bold text-lg text-text-primary">MeetingMind</span>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-150 flex items-center gap-1.5 px-4 py-2 rounded-xl hover:bg-bg-elevated/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary"
        >
          Sign in
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </nav>

      <header className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 bg-bg-elevated/60 border border-border-subtle">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-primary" aria-hidden="true" />
          <span className="text-caption font-medium text-text-secondary">AI-Powered Meeting Workspace</span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-hero font-display font-bold text-text-primary max-w-3xl mb-6 tracking-tight-ui">
          <span>Turn messy meetings</span>{" "}
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

        <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-xl mb-10">
          Upload a recording or paste a transcript. Get a structured summary,
          key decisions, and action items instantly.
        </p>

        <div className="flex flex-col items-center gap-2">
          <GoogleSignInButton variant="hero" />
          <p className="text-text-muted text-sm mt-2">No credit card required</p>
        </div>
      </header>

      <section aria-labelledby="how-heading" className="relative z-10 page-container max-w-5xl pb-20">
        <h2 id="how-heading" className="sr-only">How it works</h2>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative">
                <Card className="h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--color-accent-muted)", color: "var(--color-accent-primary)" }}
                      aria-hidden="true"
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-micro font-semibold text-text-muted tracking-caps uppercase">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1.5">{step.title}</h3>
                  <p className="text-meta text-text-secondary leading-relaxed">{step.desc}</p>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="features-heading" className="relative z-10 page-container max-w-5xl pb-20">
        <h2
          id="features-heading"
          className="text-center text-2xl md:text-3xl font-display font-bold text-text-primary mb-3 tracking-tight-ui"
        >
          Everything you need from a meeting
        </h2>
        <p className="text-center text-text-muted text-sm mb-10 max-w-md mx-auto">
          Built for teams who run on decisions and follow-through.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="group">
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-colors duration-150"
                  style={{ background: "var(--color-accent-muted)", color: "var(--color-accent-primary)" }}
                  aria-hidden="true"
                >
                  <Icon className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-semibold text-text-primary mb-1">{f.title}</h3>
                <p className="text-meta text-text-secondary leading-relaxed">{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 page-container max-w-3xl pb-20">
        <Card className="text-center py-10 px-6">
          <h2 className="text-xl md:text-2xl font-display font-bold text-text-primary mb-2 tracking-tight-ui">
            Your last meeting is still waiting
          </h2>
          <p className="text-text-secondary text-sm mb-6 max-w-sm mx-auto">
            Turn it into something your team can actually act on.
          </p>
          <GoogleSignInButton variant="hero" className="mx-auto w-auto" />
        </Card>
      </section>

      <footer className="relative z-10 border-t border-border-subtle py-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3 text-text-muted text-xs">
          <span>© 2026 MeetingMind</span>
          <span className="text-border-default" aria-hidden="true">|</span>
          <Link href="/privacy" className="hover:text-text-secondary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary">
            Privacy Policy
          </Link>
          <span className="text-border-default" aria-hidden="true">|</span>
          <Link href="/terms" className="hover:text-text-secondary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}