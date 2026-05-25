-- CareerAI Supabase schema
-- Run this in your Supabase SQL editor after creating a project.
-- Then enable Authentication > Sign In / Providers > Anonymous sign-ins.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'John Carter',
  target_role text not null default 'Software Engineer',
  email_alerts text not null default 'daily',
  plan_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  role text not null,
  skills text[] not null default '{}',
  score integer not null default 0 check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.cover_letters (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  company text not null,
  role text not null,
  highlight text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  company text not null,
  location text not null,
  match integer not null default 0 check (match between 0 and 100),
  saved boolean not null default false,
  skills text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.ats_results (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  score integer not null default 0 check (score between 0 and 100),
  insights text[] not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists resumes_touch_updated_at on public.resumes;
create trigger resumes_touch_updated_at
before update on public.resumes
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.cover_letters enable row level security;
alter table public.jobs enable row level security;
alter table public.ats_results enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id)
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

drop policy if exists "Users can manage own resumes" on public.resumes;
create policy "Users can manage own resumes"
on public.resumes for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can manage own cover letters" on public.cover_letters;
create policy "Users can manage own cover letters"
on public.cover_letters for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can manage own jobs" on public.jobs;
create policy "Users can manage own jobs"
on public.jobs for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can manage own ATS results" on public.ats_results;
create policy "Users can manage own ATS results"
on public.ats_results for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.resumes,
  public.cover_letters,
  public.jobs,
  public.ats_results
to authenticated;

grant usage, select on all sequences in schema public to authenticated;
grant all on table
  public.profiles,
  public.resumes,
  public.cover_letters,
  public.jobs,
  public.ats_results
to service_role;
