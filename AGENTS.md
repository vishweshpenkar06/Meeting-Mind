# MeetingMind

## Project Overview

AI-powered meeting transcription, analysis, and note-taking app. Upload audio/video, paste transcripts, or record live to get AI-generated summaries, action items, and key decisions.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **AI**: OpenAI (analysis/embeddings), Groq (transcription), OpenRouter, Ollama (fallbacks)
- **Audio**: FFmpeg (ffmpeg-static), Whisper (Groq API)
- **Icons**: Lucide React

## Dev Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint check
npm run test         # Run Vitest tests
npm run test:watch   # Run Vitest in watch mode
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── meetings/           # CRUD + analysis endpoints
│   │   │   ├── [id]/
│   │   │   │   ├── analyze/    # AI meeting analysis (POST)
│   │   │   │   ├── analyze-stream/  # Streaming analysis (POST)
│   │   │   │   ├── action-items/    # Toggle task completion (PATCH)
│   │   │   │   ├── diarize/    # Speaker identification (POST)
│   │   │   │   └── route.ts    # GET/PATCH/DELETE single meeting
│   │   │   └── route.ts        # GET (list/search) + POST (create)
│   │   ├── transcribe-segment/ # Live transcription chunks (POST)
│   │   └── analytics/          # Meeting analytics (GET)
│   ├── dashboard/
│   │   ├── page.tsx            # Meeting list + search
│   │   ├── new/page.tsx        # Create meeting
│   │   ├── live/page.tsx       # Real-time recording
│   │   └── analytics/page.tsx  # Analytics dashboard
│   ├── meeting/[id]/page.tsx   # Meeting detail (Notes/Actions/Transcript tabs)
│   ├── share/[token]/page.tsx  # Public shared meeting
│   ├── login/page.tsx          # Auth page
│   └── page.tsx                # Landing page
├── components/
│   ├── AudioPlayer.tsx
│   ├── InteractiveTranscript.tsx
│   ├── LandingPage.tsx
│   ├── LiveMeeting.tsx
│   └── TemplateSelector.tsx
├── lib/
│   ├── ai-providers.ts         # Multi-provider AI with fallback chain
│   ├── audio-extractor.ts      # FFmpeg video-to-audio + chunking
│   ├── exports.ts              # PDF/Markdown/Text/Slack export
│   ├── templates.ts            # Meeting templates
│   ├── transcription.ts        # Groq Whisper transcription
│   └── supabase/
│       ├── client.ts           # Browser Supabase client
│       └── server.ts           # Server Supabase client
└── middleware.ts                # Auth + route protection
```

## Key Architecture Decisions

1. **Multi-provider AI fallback**: OpenAI → Groq → OpenRouter → Ollama. Each provider is tried in order; if one fails, the next is attempted. If all fail, a basic heuristic-based fallback generates notes.

2. **Audio processing pipeline**: Files are extracted via FFmpeg (video→audio), chunked if >23MB, then transcribed via Groq Whisper API.

3. **Semantic search**: Uses OpenAI embeddings (`text-embedding-3-small`) stored in Supabase, with `match_meetings` RPC for vector similarity search. Falls back to PostgreSQL full-text search.

4. **Defensive table access**: Many API routes wrap Supabase queries in try/catch to handle tables that may not exist yet (run `sql/schema.sql` first).

## Database

Run `sql/schema.sql` in Supabase SQL Editor to set up all tables, RLS policies, storage bucket, and default templates. Safe to run multiple times (uses `IF NOT EXISTS`).

Key tables: `meetings`, `action_items`, `key_decisions`, `meeting_notes`, `transcript_segments`, `meeting_templates`, `tags`

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
OPENAI_API_KEY=                  # For analysis + embeddings
GROQ_API_KEY=                    # For transcription (free at console.groq.com)
```

Optional:
```
OPENROUTER_API_KEY=              # Fallback AI provider
OLLAMA_BASE_URL=                 # Local AI fallback
OPENAI_MODEL=                    # Override default model (gpt-4o)
GROQ_MODEL=                      # Override transcription model
```

## Code Conventions

- Use `"use client"` directive for client components
- Supabase client: `createClient()` from `@/lib/supabase/server` (server) or `@/lib/supabase/client` (browser)
- API routes use Next.js App Router format: `export async function GET/PATCH/DELETE(request, { params })`
- Params are now `Promise<{ id: string }>` — always `await params`
- Styling: Tailwind utility classes, custom CSS variables for theme colors
- Error handling: Wrap external calls in try/catch, log warnings for non-blocking failures
- No comments in code unless explicitly asked

## Design System

- **Fonts**: Space Grotesk (headings), DM Sans (body), JetBrains Mono (code/timestamps)
- **Border radius**: Use `rounded-xl` (12px) for cards, inputs, buttons. Only `rounded-full` for badges/avatars
- **Shadows**: Use CSS vars `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow`
- **Colors**: Always use CSS variables (`--color-*`), never inline hex values
- **Transitions**: Use `transition-colors duration-150` for snappy feel
- **Animation**: Use `cubic-bezier(0.25, 0.46, 0.45, 0.94)` timing function

## Testing

Use Vitest for unit tests. Place test files adjacent to source files as `*.test.ts` or `*.test.tsx`.
Run with `npm run test` or `npx vitest`.

Current test coverage:
- `src/lib/templates.test.ts` — Template selection and defaults
- `src/lib/exports.test.ts` — Share format, PDF/Markdown/Text exports
- `src/lib/ai-providers.test.ts` — Helper functions (extractSentences, extractTopics)

## PR Instructions

- Title format: `[MeetingMind] <Description>`
- Run `npm run lint` before committing
- Ensure `npm run build` passes
- Do not commit `.env.local` or any files with secrets
- Do not add comments to code unless requested
