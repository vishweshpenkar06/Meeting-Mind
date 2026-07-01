# ClaudeInfo — MeetingMind

## Project Overview

AI-powered meeting transcription, analysis, and note-taking app. Users upload audio/video, paste transcripts, or record live to get AI-generated summaries, action items, key decisions, risks, and follow-ups. Built with Next.js 16 App Router, React 19, TypeScript, Supabase, and multiple AI providers with fallback chain.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 with custom CSS theme variables in `globals.css`
- **Database**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **AI Providers**: OpenAI → Groq → OpenRouter → Ollama (fallback chain)
- **Transcription**: Groq Whisper API (`whisper-large-v3-turbo`)
- **Audio Processing**: FFmpeg (`ffmpeg-static`) for video→audio extraction and chunking
- **Embeddings**: OpenAI `text-embedding-3-small` for semantic search via Supabase `match_meetings` RPC
- **Vercel AI SDK**: Used for streaming analysis (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`)
- **PDF Export**: `jspdf`
- **Icons**: `lucide-react`
- **Validation**: `zod`

## Dev Commands

```bash
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run test         # Vitest (29 tests across 3 files)
npm run test:watch   # Vitest watch mode
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout: Space Grotesk + DM Sans + JetBrains Mono fonts
│   ├── page.tsx                # Landing page (redirects to /dashboard if logged in)
│   ├── globals.css             # Tailwind v4 theme: colors, gradients, shadows, animations
│   ├── error.tsx               # Global error boundary
│   ├── loading.tsx             # Global loading state
│   ├── login/page.tsx          # Google OAuth login page
│   ├── auth/
│   │   ├── callback/route.ts   # OAuth callback: exchanges code for session
│   │   └── auth-code-error/page.tsx  # Auth failure page
│   ├── dashboard/
│   │   ├── layout.tsx          # Dashboard layout with nav bar, sign out, profile display
│   │   ├── page.tsx            # Meeting list with search, overdue alerts, delete
│   │   ├── new/page.tsx        # Create meeting: upload/paste/record, template selector, agenda, briefing
│   │   ├── live/page.tsx       # Live recording page (wraps LiveMeeting component)
│   │   ├── analytics/page.tsx  # Analytics dashboard: charts, stats, insights
│   │   ├── error.tsx           # Dashboard error boundary
│   │   └── loading.tsx         # Dashboard loading state
│   ├── meeting/[id]/
│   │   ├── page.tsx            # Meeting detail: Notes/Actions/Transcript tabs, exports, sharing
│   │   └── error.tsx           # Meeting error boundary
│   ├── share/[token]/page.tsx  # Public shared meeting view (server component)
│   └── api/
│       ├── meetings/
│       │   ├── route.ts        # GET (list/search with semantic + text fallback) + POST (create + transcribe + analyze)
│       │   ├── analyze/route.ts        # POST: standalone analysis endpoint (auth required)
│       │   ├── briefing/route.ts       # POST: pre-meeting briefing generation
│       │   ├── generate-agenda/route.ts # POST: AI agenda generation
│       │   └── [id]/
│       │       ├── route.ts            # GET/PATCH/DELETE single meeting
│       │       ├── analyze/route.ts    # POST: full analysis pipeline (AI + diarize + embed + save)
│       │       ├── analyze-stream/route.ts # POST: streaming analysis via Vercel AI SDK
│       │       ├── action-items/route.ts   # PATCH: toggle action item completion
│       │       └── diarize/route.ts        # POST: speaker identification
│       ├── transcribe-segment/route.ts # POST: live transcription chunk (stores in Supabase Storage)
│       ├── analytics/route.ts          # GET: meeting analytics data
│       └── templates/route.ts          # GET: list templates, POST: not supported
├── components/
│   ├── LandingPage.tsx         # Marketing landing page with features grid
│   ├── LiveMeeting.tsx         # Real-time recording: MediaRecorder → 5s chunks → Groq Whisper
│   ├── AudioPlayer.tsx         # Audio player with progress, seek, mute, segment highlighting
│   ├── InteractiveTranscript.tsx # Diarized transcript: speaker grouping, search, expand/collapse
│   ├── TemplateSelector.tsx    # Meeting type selector pills (general/standup/retro/1:1/client/brainstorm)
│   └── Toast.tsx               # Toast notification system (success/error)
├── lib/
│   ├── ai-providers.ts         # Multi-provider AI: OpenAI/Groq/OpenRouter/Ollama fallback chain
│   │                           # Functions: processMeetingWithAI, analyzeSentiment, diarizeTranscript,
│   │                           #           generatePreMeetingBriefing, getAvailableProviders
│   ├── transcription.ts        # Groq Whisper transcription: extract audio → split chunks → transcribe
│   ├── audio-extractor.ts      # FFmpeg: video→audio extraction, MP3 normalization, chunk splitting
│   ├── exports.ts              # Export functions: PDF (jsPDF), Markdown, Text, Slack copy format
│   ├── templates.ts            # 6 built-in templates with AI prompt context, sample agendas, briefings
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase client (singleton, with getSession fallback)
│   │   └── server.ts           # Server Supabase client with cookie handling
│   ├── templates.test.ts       # 9 tests: template lookup, defaults, required fields
│   ├── exports.test.ts         # 10 tests: share format, dates, decisions, task counts
│   └── ai-providers.test.ts    # 10 tests: extractSentences, extractTopics helper functions
└── middleware.ts                # Auth guard: protects /dashboard, /meeting, /api routes; public: /, /login, /auth, /share
```

## Database

Run `sql/schema.sql` in Supabase SQL Editor. Safe to re-run (uses `IF NOT EXISTS`).

### Key Tables

| Table | Purpose |
|-------|---------|
| `meetings` | Core meeting records: title, summary, raw_transcript, share_token, is_public, embedding, template_name |
| `action_items` | Task items: owner_name, task_description, due_date, is_completed, meeting_id |
| `key_decisions` | Decision records: decision_text (string or JSON), meeting_id |
| `meeting_notes` | Structured notes: section (keyTopics/risks/followUps), content (JSON), meeting_id |
| `transcript_segments` | Diarized segments: speaker, text, start_time, end_time, meeting_id |
| `meeting_quality_metrics` | Analytics: sentiment_pct, engagement_pct, monologue_pct, participant_count |
| `meeting_templates` | User-defined templates (currently only built-in defaults used) |
| `tags` | Meeting tags |

### Key Functions

- `match_meetings(query_embedding, match_threshold, match_count, p_user_id)` — Vector similarity search for semantic meeting search

### Storage Buckets

- `meeting-audio` — Stores recorded audio segments for live transcription

## Environment Variables

### Required (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
OPENAI_API_KEY=                  # For analysis + embeddings
GROQ_API_KEY=                    # For transcription (free at console.groq.com)
```

### Optional

```
OPENROUTER_API_KEY=              # Fallback AI provider
OLLAMA_BASE_URL=                 # Local AI fallback
OPENAI_MODEL=                    # Override default model (gpt-4o)
OPENAI_BASE_URL=                 # Custom OpenAI-compatible endpoint
GROQ_MODEL=                      # Override analysis model (llama-3.3-70b-versatile)
GROQ_TRANSCRIPTION_MODEL=        # Override transcription model (whisper-large-v3-turbo)
OPENROUTER_MODEL=                # Override OpenRouter model
OLLAMA_MODEL=                    # Override Ollama model
```

## AI Provider Fallback Chain

1. **OpenAI** (gpt-4o) — Best quality, requires API key
2. **Groq** (llama-3.3-70b-versatile) — Fast, free tier available
3. **OpenRouter** (claude-sonnet-4-5) — Multi-model gateway
4. **Ollama** (llama3.1) — Local, no API key needed
5. **Heuristic fallback** — If all providers fail, extracts basic info from transcript using regex/NLP

Each provider is tried in order. If one fails, the next is attempted. The fallback generator runs keyword extraction, sentence splitting, and pattern matching for action items/decisions/risks.

## Architecture Patterns

### Meeting Creation Flow

1. User uploads file or pastes transcript via `/dashboard/new`
2. `POST /api/meetings` creates meeting record in Supabase
3. If file uploaded: FFmpeg extracts audio → splits into 23MB chunks → Groq Whisper transcribes each chunk → joins results
4. Meeting returned to client → client navigates to `/meeting/[id]`
5. Meeting detail page auto-triggers `POST /api/meetings/[id]/analyze` if no summary exists

### Analysis Pipeline (`/api/meetings/[id]/analyze`)

1. Fetch meeting + transcript from DB
2. Get template AI prompt context (if template selected)
3. Call `processMeetingWithAI()` through fallback chain
4. Save title + summary to meetings table
5. Delete old action_items/decisions → insert new ones
6. Diarize transcript → save transcript_segments
7. Save keyTopics/risks/followUps to meeting_notes
8. Generate embedding → save to meetings table for semantic search

### Live Recording Flow

1. User clicks "Start Recording" on `/dashboard/live`
2. Creates empty meeting via `POST /api/meetings`
3. `MediaRecorder` captures 5-second audio chunks
4. Each chunk sent to `POST /api/transcribe-segment` → stored in Supabase Storage → transcribed via Groq Whisper
5. Transcript segments displayed in real-time
6. On stop: remaining queue flushed → full transcript saved to meeting → redirect to meeting detail

### Semantic Search

1. User types search query in dashboard
2. Query embedded via OpenAI `text-embedding-3-small`
3. Supabase RPC `match_meetings` finds similar meetings by cosine distance
4. Falls back to PostgreSQL full-text search if RPC fails (table not set up)
5. Falls back to no results if embedding fails

### Auth Flow

1. Google OAuth via Supabase Auth
2. `middleware.ts` protects all routes except `/`, `/login`, `/auth/*`, `/share/*`
3. Server components use `createClient()` from `@/lib/supabase/server` (cookie-based)
4. Client components use `createClient()` from `@/lib/supabase/client` (browser singleton)

## Design System

- **Fonts**: Space Grotesk (headings, `--font-space-grotesk`), DM Sans (body, `--font-dm-sans`), JetBrains Mono (timestamps/code, `--font-jetbrains`)
- **Dark theme**: Background `#0B0F14`, surfaces `#111820`/`#1A2333`, text `#EDF2FF`/`#8A9BB5`/`#4A5E78`
- **Border radius**: `rounded-xl` (12px) for cards/inputs/buttons, `rounded-full` for badges/avatars
- **Shadows**: CSS vars `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow`
- **Colors**: Always use CSS variables (`--color-*`), never inline hex
- **Gradients**: `--gradient-hero` (blue→purple), `--gradient-shimmer`
- **Animations**: `fadeInUp`, `toast-in`, `modal-in`, `pulse-dot`, `float` — timing `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- **Focus**: `:focus-visible` with 2px blue outline + 12px border-radius

## Meeting Templates (6 Built-in)

| Name | Display Name | Use Case |
|------|-------------|----------|
| `general` | General Meeting | Standard meeting with agenda and action items |
| `standup` | Daily Standup | Yesterday/today/blockers format |
| `retro` | Sprint Retrospective | What went well/improve/actions |
| `one-on-one` | 1:1 Meeting | Check-in, feedback, career development |
| `client-call` | Client Call | Requirements, decisions, commitments |
| `brainstorm` | Brainstorm | Idea generation, evaluation, next steps |

Each template provides: `aiPromptContext` (customizes AI output format), `sampleAgenda`, `sampleBriefing`.

## Code Conventions

- `"use client"` for all client components
- Supabase: `createClient()` from `@/lib/supabase/server` (server) or `@/lib/supabase/client` (browser)
- API routes: `export async function GET/PATCH/DELETE(request, { params })`
- Params are `Promise<{ id: string }>` — always `await params`
- Styling: Tailwind utility classes + CSS variables for theme colors
- Error handling: try/catch around external calls, console.warn for non-blocking failures
- No comments in code unless explicitly asked
- Test files adjacent to source as `*.test.ts`

## Known Patterns & Gotchas

1. **Supabase tables may not exist** — Many API routes wrap queries in try/catch to handle missing tables gracefully
2. **Request body can only be read once** — Use `request.clone()` in catch handlers if you need to re-read the body
3. **`decision_text` can be string or object** — AI sometimes returns `{ decision: "..." }` instead of plain string; always check `typeof`
4. **FFmpeg path** — `ffmpeg-static` provides the binary path; if unavailable, audio is sent raw to transcription
5. **Transcript truncation** — AI analysis truncates transcripts at 15,000 chars; diarization at 12,000 chars
6. **Quality metrics** — Basic heuristic metrics computed on creation; real sentiment analysis requires AI provider
7. **Overdue items** — Filtered by `user_id` through meeting ownership join (fixed from original permissive query)

## Fixes Applied (Session Audit)

1. Created missing `/auth/auth-code-error/page.tsx`
2. Created `src/middleware.ts` for server-side auth route protection
3. Fixed overdue items query to filter by `user_id` (was leaking all users' data)
4. Added try/catch around `JSON.parse` in meeting detail route
5. Added auth check to `POST /api/meetings/analyze` endpoint
6. Removed redundant double-fetch in share handler
7. Removed all unused imports/variables across codebase (19 eslint warnings → 0)
8. Fixed TypeScript errors in test file (non-null assertions)
9. Fixed missing React Hook dependency in dashboard
10. Fixed broken error handlers in briefing/agenda routes (body re-parsing)
11. Fixed misleading "OpenAI Whisper" → "Groq Whisper" text
12. Removed unnecessary eslint-disable comment
