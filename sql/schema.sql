-- MeetingMind Database Schema
-- Run this in your Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS throughout)

-- Enable UUID extension (safe — does nothing if already exists)
create extension if not exists "uuid-ossp";

-- === NEW TABLES ===
-- Tags for meetings
create table if not exists public.tags (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  color text default '#4F8EF7',
  created_at timestamptz default now(),
  unique(user_id, name)
);

-- Meeting-tag many-to-many
create table if not exists public.meeting_tags (
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key(meeting_id, tag_id)
);

-- Meeting notes table
create table if not exists public.meeting_notes (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  section text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Transcript segments (live transcription + speaker diarization)
create table if not exists public.transcript_segments (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  speaker text,
  text text not null,
  start_time float,
  end_time float,
  created_at timestamptz default now()
);

-- Meeting templates
create table if not exists public.meeting_templates (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  display_name text not null,
  icon text,
  description text,
  is_default boolean default false,
  ai_prompt_context text,
  created_at timestamptz default now(),
  unique(user_id, name)
);

-- AI provider configs
create table if not exists public.ai_provider_configs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  provider_name text not null,
  api_key text,
  base_url text,
  model_name text not null,
  priority_order int default 1,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Meeting quality metrics
create table if not exists public.meeting_quality_metrics (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid unique references public.meetings(id) on delete cascade not null,
  sentiment_pct int default 0,
  engagement_pct int default 0,
  monologue_pct int default 0,
  action_item_completion_pct int default 0,
  participant_count int default 0,
  computed_at timestamptz default now()
);

-- Action item reminders
create table if not exists public.action_item_reminders (
  id uuid default uuid_generate_v4() primary key,
  action_item_id uuid references public.action_items(id) on delete cascade not null,
  reminder_type text not null,
  sent_at timestamptz default now(),
  status text default 'pending'
);

-- === NEW COLUMNS on existing meetings table ===
alter table public.meetings add column if not exists duration_seconds int default 0;
alter table public.meetings add column if not exists meeting_type text default 'general';
alter table public.meetings add column if not exists analysis_status text default 'completed';
alter table public.meetings add column if not exists template_id uuid references public.meeting_templates(id);
alter table public.meetings add column if not exists template_name text;

-- === FULL-TEXT SEARCH on meetings ===
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'meetings' and column_name = 'search_vector'
  ) then
    alter table public.meetings add column search_vector tsvector generated always as (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(raw_transcript, '')), 'C')
    ) stored;
  end if;
end $$;

create index if not exists meetings_search_idx on public.meetings using gin(search_vector);

-- === INDEXES ===
create index if not exists action_items_due_idx on public.action_items(due_date) where is_completed = false;
create index if not exists meetings_analysis_status_idx on public.meetings(analysis_status) where analysis_status != 'completed';

-- === ROW LEVEL SECURITY for new tables ===
alter table public.tags enable row level security;
alter table public.meeting_tags enable row level security;
alter table public.meeting_notes enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.meeting_templates enable row level security;
alter table public.ai_provider_configs enable row level security;
alter table public.meeting_quality_metrics enable row level security;
alter table public.action_item_reminders enable row level security;

-- RLS: tags
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view own tags') then
    create policy "Users can view own tags"
      on public.tags for select
      using (auth.uid() = user_id);
    create policy "Users can manage own tags"
      on public.tags for all
      using (auth.uid() = user_id);
  end if;
end $$;

-- RLS: meeting_tags
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view meeting tags from their meetings') then
    create policy "Users can view meeting tags from their meetings"
      on public.meeting_tags for select
      using (
        exists (
          select 1 from public.meetings m
          where m.id = meeting_tags.meeting_id and m.user_id = auth.uid()
        )
      );
    create policy "Users can manage meeting tags"
      on public.meeting_tags for all
      using (
        exists (
          select 1 from public.meetings m
          where m.id = meeting_tags.meeting_id and m.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- RLS: meeting_notes
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view notes from their meetings') then
    create policy "Users can view notes from their meetings"
      on public.meeting_notes for select
      using (
        exists (select 1 from public.meetings m where m.id = meeting_notes.meeting_id and (m.user_id = auth.uid() or m.is_public = true))
      );
    create policy "Users can insert notes for their meetings"
      on public.meeting_notes for insert
      with check (exists (select 1 from public.meetings m where m.id = meeting_notes.meeting_id and m.user_id = auth.uid()));
    create policy "Users can update notes from their meetings"
      on public.meeting_notes for update
      using (exists (select 1 from public.meetings m where m.id = meeting_notes.meeting_id and m.user_id = auth.uid()));
    create policy "Users can delete notes from their meetings"
      on public.meeting_notes for delete
      using (exists (select 1 from public.meetings m where m.id = meeting_notes.meeting_id and m.user_id = auth.uid()));
  end if;
end $$;

-- RLS: transcript_segments
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view segments from their meetings') then
    create policy "Users can view segments from their meetings"
      on public.transcript_segments for select
      using (
        exists (select 1 from public.meetings m where m.id = transcript_segments.meeting_id and (m.user_id = auth.uid() or m.is_public = true))
      );
    create policy "Users can insert segments for their meetings"
      on public.transcript_segments for insert
      with check (exists (select 1 from public.meetings m where m.id = transcript_segments.meeting_id and m.user_id = auth.uid()));
    create policy "Users can update segments from their meetings"
      on public.transcript_segments for update
      using (exists (select 1 from public.meetings m where m.id = transcript_segments.meeting_id and m.user_id = auth.uid()));
    create policy "Users can delete segments from their meetings"
      on public.transcript_segments for delete
      using (exists (select 1 from public.meetings m where m.id = transcript_segments.meeting_id and m.user_id = auth.uid()));
  end if;
end $$;

-- RLS: meeting_templates
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view own templates') then
    create policy "Users can view own templates"
      on public.meeting_templates for select
      using (auth.uid() = user_id or is_default = true);
    create policy "Users can insert own templates"
      on public.meeting_templates for insert
      with check (auth.uid() = user_id);
    create policy "Users can update own templates"
      on public.meeting_templates for update
      using (auth.uid() = user_id);
    create policy "Users can delete own templates"
      on public.meeting_templates for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- RLS: ai_provider_configs
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can manage own AI providers') then
    create policy "Users can manage own AI providers"
      on public.ai_provider_configs for all
      using (auth.uid() = user_id);
  end if;
end $$;

-- RLS: meeting_quality_metrics
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view own quality metrics') then
    create policy "Users can view own quality metrics"
      on public.meeting_quality_metrics for select
      using (
        exists (select 1 from public.meetings m where m.id = meeting_quality_metrics.meeting_id and m.user_id = auth.uid())
      );
    create policy "Users can insert own quality metrics"
      on public.meeting_quality_metrics for insert
      with check (
        exists (select 1 from public.meetings m where m.id = meeting_quality_metrics.meeting_id and m.user_id = auth.uid())
      );
    create policy "Users can update own quality metrics"
      on public.meeting_quality_metrics for update
      using (
        exists (select 1 from public.meetings m where m.id = meeting_quality_metrics.meeting_id and m.user_id = auth.uid())
      );
  end if;
end $$;

-- RLS: action_item_reminders
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view own reminders') then
    create policy "Users can view own reminders"
      on public.action_item_reminders for select
      using (
        exists (
          select 1 from public.action_items ai
          join public.meetings m on m.id = ai.meeting_id
          where ai.id = action_item_reminders.action_item_id and m.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- === STORAGE BUCKET ===
-- Create bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('meeting-audio', 'meeting-audio', false)
on conflict (id) do nothing;

-- Storage policies
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can upload audio') then
    create policy "Users can upload audio"
      on storage.objects for insert
      with check (bucket_id = 'meeting-audio' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can read own audio') then
    create policy "Users can read own audio"
      on storage.objects for select
      using (bucket_id = 'meeting-audio' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can delete own audio') then
    create policy "Users can delete own audio"
      on storage.objects for delete
      using (bucket_id = 'meeting-audio' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;

-- === INSERT DEFAULT TEMPLATES for existing users (safe — uses insert conflict ignore) ===
insert into public.meeting_templates (user_id, name, display_name, icon, description, is_default, ai_prompt_context)
select
  id as user_id,
  'standup'::text, 'Daily Standup', '\uD83D\uDCCB',
  'What did you do yesterday? What will you do today? Any blockers?',
  true,
  'This is a daily standup meeting. Focus on: what was completed yesterday, what will be done today, and any blockers or impediments.'
from public.profiles
on conflict (user_id, name) do nothing;

insert into public.meeting_templates (user_id, name, display_name, icon, description, is_default, ai_prompt_context)
select
  id as user_id,
  'retro'::text, 'Sprint Retrospective', '\uD83D\uDD04',
  'What went well? What could be improved? Action items for next sprint.',
  true,
  'This is a sprint retrospective meeting. Structure: What went well, what could be improved, action items for next sprint.'
from public.profiles
on conflict (user_id, name) do nothing;

insert into public.meeting_templates (user_id, name, display_name, icon, description, is_default, ai_prompt_context)
select
  id as user_id,
  'one-on-one'::text, '1:1 Meeting', '\uD83E\uDD1D',
  'Personal check-in, feedback, career development topics.',
  true,
  'This is a one-on-one meeting. Focus on personal development, feedback, career goals, and well-being.'
from public.profiles
on conflict (user_id, name) do nothing;

insert into public.meeting_templates (user_id, name, display_name, icon, description, is_default, ai_prompt_context)
select
  id as user_id,
  'client-call'::text, 'Client Call', '\uD83D\uDCDE',
  'Client discussion, requirements, decisions, next steps.',
  true,
  'This is a client call. Focus on requirements gathering, client feedback, decisions made, and next steps.'
from public.profiles
on conflict (user_id, name) do nothing;

insert into public.meeting_templates (user_id, name, display_name, icon, description, is_default, ai_prompt_context)
select
  id as user_id,
  'brainstorm'::text, 'Brainstorm', '\uD83D\uDCA1',
  'Open discussion, idea generation, creative exploration.',
  true,
  'This is a brainstorm session. Focus on capturing all ideas, themes, and prioritized concepts.'
from public.profiles
on conflict (user_id, name) do nothing;

insert into public.meeting_templates (user_id, name, display_name, icon, description, is_default, ai_prompt_context)
select
  id as user_id,
  'general'::text, 'General Meeting', '\uD83D\uDCC4',
  'Standard meeting with agenda and action items.',
  true,
  null
from public.profiles
on conflict (user_id, name) do nothing;

-- === AUTO-TEMPLATE TRIGGER (updated — replaces old handles_new_user) ===
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.meeting_templates (user_id, name, display_name, icon, description, is_default, ai_prompt_context)
  values
    (new.id, 'standup', 'Daily Standup', '\uD83D\uDCCB', 'What did you do yesterday? What will you do today? Any blockers?', true, 'This is a daily standup meeting. Focus on: what was completed yesterday, what will be done today, and any blockers or impediments.'),
    (new.id, 'retro', 'Sprint Retrospective', '\uD83D\uDD04', 'What went well? What could be improved? Action items for next sprint.', true, 'This is a sprint retrospective. What went well, what could be improved, action items.'),
    (new.id, 'one-on-one', '1:1 Meeting', '\uD83E\uDD1D', 'Personal check-in, feedback, career development topics.', true, 'This is a one-on-one meeting. Focus on personal development, feedback, career goals.'),
    (new.id, 'client-call', 'Client Call', '\uD83D\uDCDE', 'Client discussion, requirements, decisions, next steps.', true, 'This is a client call. Focus on requirements, client feedback, decisions, next steps.'),
    (new.id, 'brainstorm', 'Brainstorm', '\uD83D\uDCA1', 'Open discussion, idea generation, creative exploration.', true, 'This is a brainstorm session. Capture all ideas, themes, prioritized concepts.'),
    (new.id, 'general', 'General Meeting', '\uD83D\uDCC4', 'Standard meeting with agenda and action items.', true, null);
  return new;
end;
$$;
