<div align="center">

# MeetingMind

### AI-Powered Meeting Intelligence — From Chaos to Clarity

<br>

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

<br>

Upload a recording, paste a transcript, or record live — get AI-generated summaries, action items, key decisions, and speaker diarization instantly.

<br>

**[Live Demo](#-quick-start)** • **[Features](#-features)** • **[Architecture](#-architecture)** • **[API Reference](#-ai-provider-fallback-chain)** • **[Deploy](#-deploy)**

</div>

---

## The Problem

Every meeting produces information. Most of it gets lost.

- **Notes are inconsistent** — whoever writes them captures what they remember
- **Action items fall through** — no system to track who committed to what
- **Decisions get revisited** — "wait, did we decide X or Y?"
- **Transcripts are useless walls of text** — nobody re-reads a 45-minute transcript

**MeetingMind** fixes this by turning raw meeting audio/transcripts into structured, actionable intelligence — automatically.

---

## Features

<table>
<tr>
<td width="50%">

### AI Meeting Analysis
Summaries, decisions, action items, risks, and follow-ups extracted from any transcript using a multi-provider AI fallback chain.

### Live Recording
Record directly in the browser. Audio is transcribed in real-time using NVIDIA NIM or Groq Whisper with speaker diarization.

### Semantic Search
Find any meeting instantly with vector embeddings. Ask "what did we decide about the database?" and get relevant results.

</td>
<td width="50%">

### 6 Meeting Templates
General, Standup, Retrospective, 1:1, Client Call, and Brainstorm — each with custom AI prompts, sample agendas, and pre-meeting briefings.

### Export Anywhere
PDF, Markdown, plain text, or one-click copy formatted for Slack. Every export shares a single data pipeline — no format drift.

### Shareable Links
One-click public sharing with read-only links. No account required for viewers.

</td>
</tr>
</table>

<table>
<tr>
<td>

### Action Item Tracking
Toggle completion, edit owners/due dates inline, track overdue items across all meetings with a dashboard banner.

</td>
<td>

### Analytics Dashboard
Meeting frequency, time spent, task completion rates, sentiment scores, and weekly trend charts.

</td>
<td>

### Multi-Provider AI
NVIDIA NIM → OpenAI → Groq → OpenRouter → Ollama. Automatic failover ensures analysis always completes.

</td>
</tr>
</table>

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-username/meetingmind.git
cd meetingmind
npm install
```

### 2. Set up environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=        # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Your Supabase anon key
OPENAI_API_KEY=                  # For analysis + embeddings
GROQ_API_KEY=                    # For transcription (free at console.groq.com)
NVIDIA_API_KEY=                  # Optional — first fallback for AI + transcription
```

### 3. Set up database

Run `sql/schema.sql` in your Supabase SQL Editor. Safe to re-run (uses `IF NOT EXISTS`).

### 4. Start developing

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│  Upload /    │────▶│  Transcribe  │────▶│  AI Analysis   │────▶│  Structured  │
│  Record /    │     │  NVIDIA NIM  │     │  Multi-provider│     │  Meeting     │
│  Paste       │     │  or Groq     │     │  fallback chain│     │  Notes       │
└─────────────┘     └──────────────┘     └────────────────┘     └──────┬───────┘
                                                                       │
                              ┌──────────────────────────────────────────┘
                              ▼
               ┌──────────────────────────────┐
               │                              │
          ┌────┴────┐  ┌──────────┐  ┌───────┴───────┐
          │ Summary │  │ Actions  │  │  Decisions    │
          │ Topics  │  │ + Owner  │  │  + Risks      │
          │ Risks   │  │ + Due    │  │  + Follow-ups │
          └─────────┘  └──────────┘  └───────────────┘
```

### Meeting Creation Flow

1. User uploads audio/video, pastes a transcript, or records live
2. **Transcription**: NVIDIA NIM (parakeet) → Groq Whisper, with FFmpeg audio extraction and chunking for large files
3. **Analysis**: AI provider chain extracts structured data (title, summary, decisions, action items, topics, risks, follow-ups)
4. **Storage**: All data saved to Supabase with vector embeddings for semantic search
5. **Display**: Interactive meeting detail page with Notes, Actions, and Transcript tabs

---

## AI Provider Fallback Chain

MeetingMind tries each provider in order. If one fails, the next is attempted automatically.

| Priority | Provider | Model | Best For | Requires |
|----------|----------|-------|----------|----------|
| 1 | **NVIDIA NIM** | `nvidia/llama-3.3-nemotron-super-49b-v1` | Fast analysis + transcription | `NVIDIA_API_KEY` |
| 2 | **OpenAI** | `gpt-4o` | Highest quality analysis | `OPENAI_API_KEY` |
| 3 | **Groq** | `llama-3.3-70b-versatile` | Fast, free tier | `GROQ_API_KEY` |
| 4 | **OpenRouter** | `claude-sonnet-4-5` | Multi-model gateway | `OPENROUTER_API_KEY` |
| 5 | **Ollama** | `llama3.1` | Local, no API key | `OLLAMA_BASE_URL` |
| 6 | **Heuristic** | — | Regex/NLP fallback | — |

**Transcription** follows the same pattern: NVIDIA NIM (`parakeet-tdt-0.6b-v2`) → Groq Whisper (`whisper-large-v3-turbo`).

---

## Meeting Templates

Each template customizes the AI prompt to match the meeting format:

| Template | Use Case | Output Format |
|----------|----------|---------------|
| **General** | Standard meetings | What Was Discussed → Key Outcomes → Next Steps |
| **Standup** | Daily syncs | Yesterday → Today → Blockers (per-person) |
| **Retrospective** | Sprint retros | What Went Well → What Could Improve → Actions |
| **1:1** | Manager-report | Check-in → Feedback → Career Development → Support |
| **Client Call** | Client meetings | Requirements → Decisions → Commitments → Feedback |
| **Brainstorm** | Ideation sessions | Ideas → Top Candidates → Themes → Next Steps |

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── meetings/              # CRUD + analysis endpoints
│   │   │   ├── [id]/
│   │   │   │   ├── analyze/       # Full analysis pipeline
│   │   │   │   ├── analyze-stream/# Streaming analysis (Vercel AI SDK)
│   │   │   │   ├── action-items/  # Toggle + edit task completion
│   │   │   │   ├── decisions/     # Edit key decisions
│   │   │   │   └── diarize/       # Speaker identification
│   │   │   ├── briefing/          # Pre-meeting briefing generation
│   │   │   └── generate-agenda/   # AI agenda generation
│   │   ├── transcribe-segment/    # Live transcription chunks
│   │   ├── analytics/             # Meeting analytics
│   │   └── templates/             # Template listing
│   ├── dashboard/                 # Meeting list, new, live, analytics
│   ├── meeting/[id]/              # Meeting detail (Notes/Actions/Transcript)
│   ├── share/[token]/             # Public shared meeting view
│   ├── login/                     # Google OAuth
│   └── auth/callback/             # OAuth callback
├── components/
│   ├── AudioPlayer.tsx            # Audio player with segment highlighting
│   ├── GoogleSignInButton.tsx     # Shared auth button
│   ├── InteractiveTranscript.tsx  # Diarized transcript with search
│   ├── LandingPage.tsx            # Marketing landing page
│   ├── LiveMeeting.tsx            # Real-time recording
│   ├── TemplateSelector.tsx       # Meeting type picker
│   └── Toast.tsx                  # Notification system
├── lib/
│   ├── ai-providers.ts            # Multi-provider AI with fallback chain
│   ├── transcription.ts           # NVIDIA NIM / Groq transcription
│   ├── audio-extractor.ts         # FFmpeg video→audio + chunking
│   ├── exports.ts                 # PDF/Markdown/Text/Slack exports
│   ├── templates.ts               # 6 built-in meeting templates
│   └── supabase/                  # Server + browser Supabase clients
├── middleware.ts                   # Auth route protection
└── sql/
    ├── schema.sql                 # Full database schema
    └── vector_migration.sql       # Embedding migration
```

---

## Database

Supabase (PostgreSQL) with Row Level Security. Run `sql/schema.sql` to set up:

| Table | Purpose |
|-------|---------|
| `meetings` | Core records — title, summary, transcript, embeddings, share tokens |
| `action_items` | Tasks with owner, due date, completion status |
| `key_decisions` | Decision records with context |
| `meeting_notes` | Structured notes — topics, risks, follow-ups |
| `transcript_segments` | Diarized speaker-labeled segments |
| `meeting_quality_metrics` | Sentiment, engagement, monologue percentages |

---

## Environment Variables

### Required

```env
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
OPENAI_API_KEY=                  # For analysis + embeddings
GROQ_API_KEY=                    # For transcription
```

### Optional

```env
NVIDIA_API_KEY=                  # NVIDIA NIM — first fallback
NVIDIA_MODEL=                    # Override (nvidia/llama-3.3-nemotron-super-49b-v1)
NVIDIA_TRANSCRIPTION_MODEL=      # Override (nvidia/parakeet-tdt-0.6b-v2)
OPENROUTER_API_KEY=              # Fallback AI provider
OLLAMA_BASE_URL=                 # Local AI fallback
OPENAI_MODEL=                    # Override (gpt-4o)
GROQ_MODEL=                      # Override analysis model
GROQ_TRANSCRIPTION_MODEL=        # Override (whisper-large-v3-turbo)
```

---

## Dev Commands

```bash
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run test         # Vitest (34 tests)
npm run test:watch   # Vitest watch mode
```

---

## Testing

34 tests across 3 test suites:

```bash
npm run test
# ✓ ai-providers.test.ts  — extractSentences, extractTopics, due date validation
# ✓ templates.test.ts     — Template lookup, defaults, required fields
# ✓ exports.test.ts       — Share format, dates, decisions, task counts
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, Tailwind CSS v4 |
| **Language** | TypeScript (strict) |
| **Database** | Supabase (PostgreSQL + Auth + Storage) |
| **AI** | NVIDIA NIM, OpenAI, Groq, OpenRouter, Ollama |
| **Transcription** | NVIDIA Parakeet, Groq Whisper |
| **Audio** | FFmpeg (ffmpeg-static) |
| **Embeddings** | OpenAI text-embedding-3-small |
| **PDF** | jsPDF |
| **Icons** | Lucide React |
| **Validation** | Zod |

---

## Deploy

### Vercel (recommended)

```bash
npx vercel
```

Set environment variables in the Vercel dashboard. Ensure `sql/schema.sql` has been run in your Supabase project.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Self-Hosted

Any Node.js 18+ hosting works. Set environment variables and run:

```bash
npm run build
npm run start
```

---

## Design System

- **Fonts**: Space Grotesk (headings), DM Sans (body), JetBrains Mono (timestamps)
- **Theme**: Dark-first with CSS custom properties
- **Colors**: `--color-accent-primary: #4F8EF7`, `--gradient-hero: linear-gradient(135deg, #4F8EF7, #8B5CF6)`
- **Radius**: `rounded-xl` (12px) for cards and inputs
- **Animations**: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` timing

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### PR Guidelines

- Title format: `[MeetingMind] <Description>`
- Run `npm run lint` before committing
- Ensure `npm run build` passes
- Do not commit `.env.local` or secrets
- No comments in code unless requested

---

## License

MIT License — use freely for personal and commercial purposes.

---

<div align="center">

**Built with passion for privacy-first meeting intelligence.**

Star this repo if MeetingMind helps you run better meetings.

</div>
