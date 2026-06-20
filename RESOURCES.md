# MeetingMind — Required Resources & API Keys

## Required API Keys

### 1. Groq API Key (Transcription — CRITICAL)
- **What it does**: Powers speech-to-text for both live recording and file uploads
- **Get it at**: https://console.groq.com/keys
- **Free tier**: Yes — generous free usage
- **Model used**: `whisper-large-v3-turbo`
- **Env var**: `GROQ_API_KEY`
- **Note**: Without this key, NO audio/video transcription will work

### 2. OpenAI API Key (AI Analysis + Embeddings)
- **What it does**: Summarizes meetings, extracts decisions/action items, generates search embeddings
- **Get it at**: https://platform.openai.com/api-keys
- **Or use a compatible provider** (Groq, OpenRouter, Ollama) by setting `OPENAI_BASE_URL`
- **Env var**: `OPENAI_API_KEY`
- **Optional env vars**:
  - `OPENAI_MODEL` — override model (default: `gpt-4o`)
  - `OPENAI_BASE_URL` — custom base URL for compatible providers

### 3. Supabase Project (Database + Auth + Storage)
- **What it does**: User auth, meeting storage, vector search, file storage
- **Get it at**: https://supabase.com (free tier available)
- **Env vars**:
  - `NEXT_PUBLIC_SUPABASE_URL` — your project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your anon/public key
- **Setup required**:
  1. Create a new project
  2. Run `sql/schema.sql` in the SQL Editor
  3. Run `sql/vector_migration.sql` in the SQL Editor
  4. Enable Google OAuth in Authentication > Providers (optional)

## Optional API Keys

### 4. OpenRouter API Key (AI Fallback)
- **What it does**: Backup AI provider if OpenAI fails
- **Get it at**: https://openrouter.ai/keys
- **Env var**: `OPENROUTER_API_KEY`

### 5. Ollama (Local AI — No API Key Needed)
- **What it does**: Run AI locally for free (no cloud API needed)
- **Get it at**: https://ollama.com
- **Setup**: Install Ollama, run `ollama pull llama3.1`
- **Env var**: `OLLAMA_BASE_URL` (typically `http://localhost:11434`)

## Quick Start

1. Copy `.env.local.example` to `.env.local`
2. Fill in at minimum:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   OPENAI_API_KEY=sk-your-key
   GROQ_API_KEY=gsk_your-key
   ```
3. Run `npm run dev`
4. Open http://localhost:3000

## Troubleshooting Transcription

If audio/video transcription isn't working:

1. **Check GROQ_API_KEY is set** in `.env.local`
2. **Check server logs** — transcription errors are now logged with details
3. **For video files** — FFmpeg is required to extract audio. If FFmpeg isn't available:
   - The app will try to send the raw file to Groq (may work for small files)
   - Install FFmpeg: `npm install ffmpeg-static` (auto-downloads binary)
4. **For live recording** — ensure microphone permissions are granted in browser
5. **File size limits**:
   - Audio: 25MB max
   - Video: 500MB max
   - Live recording chunks: ~5 seconds each (sent in real-time)
