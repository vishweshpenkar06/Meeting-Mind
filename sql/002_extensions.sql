-- 002_extensions.sql — everything schema.sql adds on top of 001_core.sql
--
-- Tags, notes, segments, templates, quality metrics, storage, and search.
-- Kept separate from 001 so the base tables can be reasoned about on their own.
-- This file is idempotent and safe to re-run.

create extension if not exists "uuid-ossp";

create table if not exists public.tags (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  color text default '#4F8EF7',
  created_at timestamptz default now(),
  unique(user_id, name)
);

create table if not exists public.meeting_tags (
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key(meeting_id, tag_id)
);

create table if not exists public.meeting_notes (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  section text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.transcript_segments (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  speaker text,
  text text not null,
  start_time float,
  end_time float,
  created_at timestamptz default now()
);

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

alter table public.meetings add column if not exists duration_seconds int default 0;
alter table public.meetings add column if not exists meeting_type text default 'general';
alter table public.meetings add column if not exists analysis_status text default 'completed';
alter table public.meetings add column if not exists template_name text;

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
create index if not exists action_items_due_idx on public.action_items(due_date) where is_completed = false;
create index if not exists segments_meeting_idx on public.transcript_segments(meeting_id);
create index if not exists notes_meeting_idx on public.meeting_notes(meeting_id);

alter table public.tags enable row level security;
alter table public.meeting_tags enable row level security;
alter table public.meeting_notes enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.meeting_templates enable row level security;
alter table public.meeting_quality_metrics enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can manage own tags') then
    create policy "Users can manage own tags" on public.tags for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users can manage meeting tags') then
    create policy "Users can manage meeting tags" on public.meeting_tags for all
      using (exists (select 1 from public.meetings m where m.id = meeting_tags.meeting_id and m.user_id = auth.uid()))
      with check (exists (select 1 from public.meetings m where m.id = meeting_tags.meeting_id and m.user_id = auth.uid()));
  end if;

  -- DELETE/UPDATE are required here: analysis clears and rewrites these rows,
  -- and without them the deletes fail silently under RLS.
  if not exists (select 1 from pg_policies where policyname = 'Users can manage own notes') then
    create policy "Users can manage own notes" on public.meeting_notes for all
      using (exists (select 1 from public.meetings m where m.id = meeting_notes.meeting_id and m.user_id = auth.uid()))
      with check (exists (select 1 from public.meetings m where m.id = meeting_notes.meeting_id and m.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users can manage own segments') then
    create policy "Users can manage own segments" on public.transcript_segments for all
      using (exists (select 1 from public.meetings m where m.id = transcript_segments.meeting_id and m.user_id = auth.uid()))
      with check (exists (select 1 from public.meetings m where m.id = transcript_segments.meeting_id and m.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users can manage own templates') then
    create policy "Users can manage own templates" on public.meeting_templates for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- upsert on conflict requires an UPDATE policy, not just INSERT
  if not exists (select 1 from pg_policies where policyname = 'Users can manage own quality metrics') then
    create policy "Users can manage own quality metrics" on public.meeting_quality_metrics for all
      using (exists (select 1 from public.meetings m where m.id = meeting_quality_metrics.meeting_id and m.user_id = auth.uid()))
      with check (exists (select 1 from public.meetings m where m.id = meeting_quality_metrics.meeting_id and m.user_id = auth.uid()));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('meeting-audio', 'meeting-audio', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can upload audio') then
    create policy "Users can upload audio" on storage.objects for insert
      with check (bucket_id = 'meeting-audio' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can read own audio') then
    create policy "Users can read own audio" on storage.objects for select
      using (bucket_id = 'meeting-audio' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can delete own audio') then
    create policy "Users can delete own audio" on storage.objects for delete
      using (bucket_id = 'meeting-audio' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;
