<div align="center">

# MeetingMind

### Turn Messy Meetings Into Clear Action Plans

<br>

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

<br>

**Upload a recording. Paste a transcript. Record live.**
**Get AI-generated summaries, action items, key decisions, and speaker diarization — instantly.**

<br>

**[Get Started](#-get-started-in-2-minutes)** · **[How It Works](#-architecture)** · **[Features](#-features)** · **[Deploy](#-deploy)**

</div>

---

<br>

## Problem

Every meeting generates information. Most of it gets lost.

- **Notes are inconsistent** — whoever writes them captures what they remember, not what mattered
- **Action items fall through** — someone says "I'll handle that" and nobody follows up
- **Decisions get revisited** — "wait, did we decide X or Y?" three meetings later
- **Transcripts are useless** — a 45-minute wall of text that nobody re-reads
- **Finding anything is impossible** — "what did we say about the API migration?" requires scrubbing through hours of recordings

**MeetingMind** solves this by turning raw meeting audio and transcripts into structured, searchable, shareable intelligence — automatically.

---

## Architecture

```
User Input (Audio / Transcript / Live Recording)
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Step 1: Audio Extraction (FFmpeg)               │
│  Video → Audio conversion + chunking for large   │
│  files (23MB segments for API limits)             │
├─────────────────────────────────────────────────┤
│  Step 2: Transcription (NVIDIA NIM → Groq)       │
│  Speech → Text with language auto-detection       │
│  Supports 21 languages via Whisper               │
├─────────────────────────────────────────────────┤
│  Step 3: AI Analysis (5-provider fallback)       │
│  NVIDIA NIM → OpenAI → Groq → OpenRouter → Ollama│
│  Extracts: summary, decisions, actions, risks,   │
│  topics, follow-ups                              │
├─────────────────────────────────────────────────┤
│  Step 4: Speaker Diarization                     │
│  AI-powered or heuristic speaker identification  │
│  Labeled, color-coded transcript segments        │
├─────────────────────────────────────────────────┤
│  Step 5: Semantic Embedding                      │
│  OpenAI text-embedding-3-small → vector search   │
│  Fallback to PostgreSQL full-text search          │
├─────────────────────────────────────────────────┤
│  Step 6: Storage & Presentation                  │
│  Supabase (PostgreSQL + RLS + Storage)           │
│  Interactive detail page with 3 tabs             │
└─────────────────────────────────────────────────┘
      │
      ▼
Structured Meeting Intelligence
```

Each step is a separate module. If any AI provider fails, the next in the chain picks up automatically. If all providers are unreachable, a heuristic fallback still extracts basic information.

---

## Features

### Three Ways to Start

Whatever your meeting looks like, MeetingMind handles it.

- **Upload** — Drag in a recording from Zoom, Teams, Google Meet, or any recorder. Video files get audio extracted automatically via FFmpeg.
- **Paste** — Already have a transcript? Drop it in. Works with any text format.
- **Record** — Hit the mic and talk. Audio is captured in 5-second chunks, transcribed in real-time, and displayed as you speak.

### Six Meeting Modes

MeetingMind doesn't produce the same generic summary for every meeting. It adapts.

| Mode | What It Produces |
|------|-----------------|
| **General** | What Was Discussed → Key Outcomes → Next Steps |
| **Standup** | Per-person: Yesterday → Today → Blockers |
| **Retrospective** | Wins → Pain Points → Process Improvements |
| **1:1** | Check-in → Feedback → Growth Areas → Support Needed |
| **Client Call** | Requirements → Decisions → Commitments → Feedback |
| **Brainstorm** | All Ideas → Top Picks → Patterns → Evaluation Plan |

Each mode includes a suggested agenda and pre-meeting briefing generated from your recent meeting history.

### Structured Meeting Detail Page

Every analyzed meeting gets its own page with three tabs:

**Notes** — Sectioned summary with expandable topics, key decisions, identified risks, and open questions. Each section is collapsible and searchable.

**Actions** — Task list with owner, priority badge, and due date. Click to toggle completion. Click any field to edit inline — owner name, task text, or due date. All changes save via API.

**Transcript** — Full diarized transcript with color-coded speaker labels. Searchable across all segments. Expand/collapse by speaker. Synced with audio playback when a recording is attached.

### Semantic Search

Type a question like *"what did we decide about the database?"* and get ranked results from across all your meetings. Uses OpenAI embeddings stored in Supabase with vector similarity search. Falls back to PostgreSQL full-text search automatically.

### Shareable Links

One click generates a public read-only link. Anyone with the link can view the meeting summary, decisions, and action items — no account required. Toggle public/private from the meeting menu.

### Export Pipeline

Every export format — PDF, Markdown, plain text, Slack — builds from a single shared data function. No format drift. The PDF includes brand-colored section headers, meeting title, date, and attribution. The Markdown has proper task checkboxes. The Slack format has emoji status indicators.

### Analytics Dashboard

Tracks meeting frequency, time spent, task completion rates, sentiment scores, and weekly trends across 8 weeks. Includes per-meeting-type breakdown and actionable insights when completion rates drop below 50%.

### Overdue Task Tracking

Dashboard banner surfaces overdue tasks across all meetings. Expand to see owner, task description, and which meeting it belongs to. Click any task to jump directly to it.

---

## Multi-Provider AI Fallback Chain

MeetingMind tries each provider in order. If one fails, the next is attempted automatically.

| Priority | Provider | Model | Purpose |
|----------|----------|-------|---------|
| 1 | **NVIDIA NIM** | `nvidia/llama-3.3-nemotron-super-49b-v1` | Analysis + diarization |
| 2 | **OpenAI** | `gpt-4o` | Highest quality analysis + embeddings |
| 3 | **Groq** | `llama-3.3-70b-versatile` | Fast analysis, free tier |
| 4 | **OpenRouter** | `claude-sonnet-4-5` | Multi-model gateway |
| 5 | **Ollama** | `llama3.1` | Local, no API key needed |
| 6 | **Heuristic** | Regex + NLP | Always-available fallback |

**Transcription** follows the same pattern: NVIDIA Parakeet (`nvidia/parakeet-tdt-0.6b-v2`) → Groq Whisper (`whisper-large-v3-turbo`).

---

## Meeting Templates

Each template customizes the AI prompt to match the meeting format:

| Template | Use Case | Output Structure |
|----------|----------|-----------------|
| **General** | Standard meetings | Sections with bullet points |
| **Standup** | Daily syncs | Per-person blocks with [bracketed] names |
| **Retrospective** | Sprint retros | Emoji-labeled categories with action items |
| **1:1** | Manager-report | Empathetic sections focused on growth |
| **Client Call** | Client meetings | Requirements, commitments, deadlines |
| **Brainstorm** | Ideation sessions | Idea quantity, evaluation, prototyping plan |

Templates include `aiPromptContext` (customizes AI output format), `sampleAgenda`, and `sampleBriefing`.

---

## Features Checklist

✅ Audio/Video Upload with FFmpeg Extraction
✅ Real-Time Live Recording with Chunked Transcription
✅ 6 Meeting Templates with Custom AI Prompts
✅ 5-Provider AI Fallback Chain
✅ 2-Provider Transcription Fallback Chain
✅ Speaker Diarization (AI + Heuristic)
✅ Inline Editing for Action Items and Decisions
✅ Due Date Validation Against Meeting Date
✅ Semantic Search with Vector Embeddings
✅ Shareable Public Meeting Links
✅ PDF / Markdown / Text / Slack Exports
✅ Analytics Dashboard with Weekly Trends
✅ Overdue Task Banner with Meeting Links
✅ Sort and Filter on Dashboard
✅ Google OAuth via Supabase Auth
✅ Row Level Security on All Tables
✅ 34 Unit Tests Across 3 Suites
✅ Server-Side Auth Middleware
✅ Error Boundaries on Every Route

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19 + Tailwind CSS v4 |
| **Language** | TypeScript (strict mode) |
| **Database** | Supabase (PostgreSQL + Auth + Storage + RLS) |
| **AI Providers** | NVIDIA NIM, OpenAI, Groq, OpenRouter, Ollama |
| **Transcription** | NVIDIA Parakeet, Groq Whisper |
| **Audio Processing** | FFmpeg via ffmpeg-static |
| **Embeddings** | OpenAI text-embedding-3-small |
| **PDF Export** | jsPDF |
| **Icons** | Lucide React |
| **Fonts** | Space Grotesk · DM Sans · JetBrains Mono |

---

## Design System

Built with a **dark-first design system** using CSS custom properties:

- **Color Variables** — `--color-accent-primary`, `--gradient-hero`, 15+ semantic tokens
- **Typography** — Space Grotesk (headings), DM Sans (body), JetBrains Mono (timestamps)
- **Components** — `rounded-xl` cards, gradient buttons, frosted-glass nav
- **Animations** — `fadeInUp`, `toast-in`, `pulse-dot` with `cubic-bezier(0.25, 0.46, 0.45, 0.94)` timing
- **Zero Inline Colors** — Every color references a CSS variable

---

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- Supabase project (free tier works)
- At least one AI API key (OpenAI or Groq minimum)

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/meetingmind.git
   cd meetingmind
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` with your keys (see [Environment Variables](#environment-variables)).

4. **Set Up Database**
   Run `sql/schema.sql` in your Supabase SQL Editor.

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Access the Application**
   Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `OPENAI_API_KEY` | For analysis + embeddings |
| `GROQ_API_KEY` | For transcription (free at console.groq.com) |

### Optional

| Variable | Description |
|----------|-------------|
| `NVIDIA_API_KEY` | NVIDIA NIM — first fallback for AI + transcription |
| `NVIDIA_MODEL` | Override model (default: `nvidia/llama-3.3-nemotron-super-49b-v1`) |
| `NVIDIA_TRANSCRIPTION_MODEL` | Override transcription model (default: `nvidia/parakeet-tdt-0.6b-v2`) |
| `OPENROUTER_API_KEY` | Fallback AI provider |
| `OLLAMA_BASE_URL` | Local AI fallback (no API key needed) |
| `OPENAI_MODEL` | Override analysis model (default: `gpt-4o`) |
| `GROQ_MODEL` | Override Groq analysis model |
| `GROQ_TRANSCRIPTION_MODEL` | Override transcription model (default: `whisper-large-v3-turbo`) |

---

## Project Structure

```text
meetingmind/
├── app/
│   ├── api/
│   │   ├── meetings/                CRUD + AI analysis + transcription
│   │   │   ├── [id]/
│   │   │   │   ├── analyze/         Full analysis pipeline
│   │   │   │   ├── analyze-stream/  Streaming analysis (Vercel AI SDK)
│   │   │   │   ├── action-items/    Toggle + edit task completion
│   │   │   │   ├── decisions/       Edit key decisions
│   │   │   │   └── diarize/         Speaker identification
│   │   │   ├── briefing/            Pre-meeting briefing generation
│   │   │   └── generate-agenda/     AI agenda suggestions
│   │   ├── transcribe-segment/      Live transcription chunks
│   │   ├── analytics/               Meeting analytics
│   │   └── templates/               Template listing
│   ├── dashboard/                   Meeting list, creation, live, analytics
│   ├── meeting/[id]/                Detail page (Notes · Actions · Transcript)
│   ├── share/[token]/               Public shared meeting view
│   ├── login/                       Google OAuth
│   └── auth/                        OAuth callback + error handling
├── components/
│   ├── AudioPlayer.tsx              Player with segment highlighting
│   ├── GoogleSignInButton.tsx       Shared auth component
│   ├── InteractiveTranscript.tsx    Diarized transcript viewer
│   ├── LandingPage.tsx              Marketing landing page
│   ├── LiveMeeting.tsx              Real-time recording
│   ├── TemplateSelector.tsx         Meeting type picker (3-col grid)
│   └── Toast.tsx                    Notification system
├── lib/
│   ├── ai-providers.ts              Multi-provider AI fallback chain
│   ├── transcription.ts             NVIDIA NIM / Groq transcription
│   ├── audio-extractor.ts           FFmpeg video→audio + chunking
│   ├── exports.ts                   Shared data → PDF/MD/TXT/Slack
│   ├── templates.ts                 6 meeting modes with AI prompts
│   └── supabase/                    Server + browser Supabase clients
├── middleware.ts                     Auth route protection
└── sql/
    ├── schema.sql                   Full database schema + RLS
    └── vector_migration.sql         Embedding migration
```

---

## Database

Supabase PostgreSQL with Row Level Security. Run `sql/schema.sql` to set up everything.

| Table | Purpose |
|-------|---------|
| `meetings` | Core records — title, summary, transcript, embeddings, share tokens |
| `action_items` | Tasks with owner, due date, completion status |
| `key_decisions` | Decision records |
| `meeting_notes` | Structured notes — topics, risks, follow-ups |
| `transcript_segments` | Diarized speaker-labeled segments |
| `meeting_quality_metrics` | Sentiment, engagement, monologue percentages |
| `meeting_templates` | User-defined templates |
| `tags` | Meeting tags |

Vector search via `match_meetings` RPC function using OpenAI embeddings.

---

## Testing

```bash
npm run test        # Run all 34 tests
npm run test:watch  # Watch mode
```

Three test suites cover core logic:

| Suite | Tests | Coverage |
|-------|-------|----------|
| `ai-providers.test.ts` | 15 | Sentence extraction, topic extraction, due date validation |
| `templates.test.ts` | 9 | Template lookup, defaults, required fields |
| `exports.test.ts` | 10 | Share format, date handling, decision parsing, task counts |

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/meetings` | List meetings (semantic search via `?q=`) |
| POST | `/api/meetings` | Create meeting (upload file, paste transcript, or audio URL) |
| GET | `/api/meetings/[id]` | Get meeting with all related data |
| PATCH | `/api/meetings/[id]` | Update meeting title, summary, visibility |
| DELETE | `/api/meetings/[id]` | Delete meeting |
| POST | `/api/meetings/[id]/analyze` | Run AI analysis pipeline |
| POST | `/api/meetings/[id]/analyze-stream` | Streaming analysis (Vercel AI SDK) |
| POST | `/api/meetings/[id]/diarize` | Speaker identification |
| PATCH | `/api/meetings/[id]/action-items` | Toggle + edit action items |
| PATCH | `/api/meetings/[id]/decisions` | Edit key decisions |
| POST | `/api/meetings/briefing` | Pre-meeting briefing generation |
| POST | `/api/meetings/generate-agenda` | AI agenda generation |
| POST | `/api/transcribe-segment` | Live transcription chunk |
| GET | `/api/analytics` | Meeting analytics data |
| GET | `/api/templates` | List available templates |

---

## Deploy

### Vercel (Recommended)

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

Any Node.js 18+ hosting works:

```bash
npm run build
npm run start
```

---

## Contributing

1. Fork the Repository
2. Create your Feature Branch (`git checkout -b feature/amazing-feature`)
3. Commit your Changes (`git commit -m 'Add amazing feature'`)
4. Push to the Branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### PR Guidelines

- Title format: `[MeetingMind] <Description>`
- Run `npm run lint` before committing
- Ensure `npm run build` passes
- Do not commit `.env.local` or secrets
- No comments in code unless requested

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Author

**Vishwesh Penkar**

B.Tech Artificial Intelligence & Machine Learning

Mumbai University, India

---

<div align="center">

**Your meetings generate information. MeetingMind makes it useful.**

</div>
