-- 001_core.sql — base tables
--
-- These four tables predate schema.sql, which only ALTERs them. They were never
-- committed, so a fresh database could not be bootstrapped. This file plus
-- 002_extensions.sql is the complete schema.

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists public.meetings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text default 'Untitled Meeting',
  summary text default '',
  raw_transcript text,
  audio_url text,
  is_public boolean default false,
  share_token uuid,
  created_at timestamptz default now()
);

create table if not exists public.action_items (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  owner_name text not null default 'Unassigned',
  task_description text not null,
  due_date date,
  is_completed boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.key_decisions (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  decision_text text,
  created_at timestamptz default now()
);

create index if not exists action_items_meeting_idx on public.action_items(meeting_id);
create index if not exists key_decisions_meeting_idx on public.key_decisions(meeting_id);
create index if not exists meetings_user_idx on public.meetings(user_id);

alter table public.profiles enable row level security;
alter table public.meetings enable row level security;
alter table public.action_items enable row level security;
alter table public.key_decisions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can read own profile') then
    create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
    create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users can manage own meetings') then
    create policy "Users can manage own meetings" on public.meetings for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- Share links are readable by anyone holding the token, which is why the
  -- application layer strips raw_transcript before responding.
  if not exists (select 1 from pg_policies where policyname = 'Public can read shared meetings') then
    create policy "Public can read shared meetings" on public.meetings for select
      using (is_public = true and share_token is not null);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users can manage own action items') then
    create policy "Users can manage own action items" on public.action_items for all
      using (exists (select 1 from public.meetings m where m.id = action_items.meeting_id and m.user_id = auth.uid()))
      with check (exists (select 1 from public.meetings m where m.id = action_items.meeting_id and m.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users can manage own decisions') then
    create policy "Users can manage own decisions" on public.key_decisions for all
      using (exists (select 1 from public.meetings m where m.id = key_decisions.meeting_id and m.user_id = auth.uid()))
      with check (exists (select 1 from public.meetings m where m.id = key_decisions.meeting_id and m.user_id = auth.uid()));
  end if;
end $$;

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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
