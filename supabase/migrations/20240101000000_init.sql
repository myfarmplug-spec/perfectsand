-- Perfect Sand — Initial Schema
-- Run with: supabase db push

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- USERS (public profile, extends auth.users)
-- ─────────────────────────────────────────────
create table public.users (
  id              uuid references auth.users(id) on delete cascade primary key,
  email           text not null,
  full_name       text,
  code_name       text,
  dob             date,
  gender          text,
  location        text,
  biggest_trigger text,
  onboarding_complete boolean default false,
  created_at      timestamptz default now()
);

alter table public.users enable row level security;

create policy "users: read own" on public.users
  for select using (auth.uid() = id);

create policy "users: insert own" on public.users
  for insert with check (auth.uid() = id);

create policy "users: update own" on public.users
  for update using (auth.uid() = id);

-- ─────────────────────────────────────────────
-- USER PROGRESS
-- ─────────────────────────────────────────────
create table public.user_progress (
  id                    uuid default gen_random_uuid() primary key,
  user_id               uuid references public.users(id) on delete cascade unique not null,
  control_level         integer default 0,
  current_streak        integer default 0,
  longest_streak        integer default 0,
  total_urges_resisted  integer default 0,
  total_days_locked     integer default 0,
  sand_guardian_level   integer default 1,
  level_name            text default 'Sand Cadet',
  updated_at            timestamptz default now()
);

alter table public.user_progress enable row level security;

create policy "progress: read own" on public.user_progress
  for select using (auth.uid() = user_id);

create policy "progress: insert own" on public.user_progress
  for insert with check (auth.uid() = user_id);

create policy "progress: update own" on public.user_progress
  for update using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- TOKENS
-- ─────────────────────────────────────────────
create table public.tokens (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references public.users(id) on delete cascade unique not null,
  balance      integer default 50,
  last_updated timestamptz default now()
);

alter table public.tokens enable row level security;

create policy "tokens: read own" on public.tokens
  for select using (auth.uid() = user_id);

-- No direct client insert/update — all mutations via Edge Functions only
create policy "tokens: insert own (onboarding)" on public.tokens
  for insert with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- URGES
-- ─────────────────────────────────────────────
create table public.urges (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references public.users(id) on delete cascade not null,
  trigger_type text not null,
  emotion      text,
  note         text,
  resisted     boolean default false,
  learned      text,
  created_at   timestamptz default now()
);

alter table public.urges enable row level security;

create policy "urges: all own" on public.urges
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- DAILY LOGS
-- ─────────────────────────────────────────────
create table public.daily_logs (
  id                   uuid default gen_random_uuid() primary key,
  user_id              uuid references public.users(id) on delete cascade not null,
  date                 date not null,
  morning_done         boolean default false,
  focus_done           boolean default false,
  night_done           boolean default false,
  routines_completed   integer default 0,
  day_locked           boolean default false,
  locked_at            timestamptz,
  unique(user_id, date)
);

alter table public.daily_logs enable row level security;

create policy "daily_logs: all own" on public.daily_logs
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- TOKEN TRANSACTIONS
-- ─────────────────────────────────────────────
create table public.token_transactions (
  id                  uuid default gen_random_uuid() primary key,
  user_id             uuid references public.users(id) on delete cascade not null,
  type                text not null check (type in ('earn', 'spend', 'purchase', 'signup_bonus')),
  amount              integer not null,
  description         text,
  paystack_reference  text,
  status              text default 'completed' check (status in ('pending', 'completed', 'failed')),
  created_at          timestamptz default now()
);

alter table public.token_transactions enable row level security;

create policy "transactions: read own" on public.token_transactions
  for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- FUNCTION: create_user_on_signup
-- Triggered by Supabase Auth on new user
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Create public user profile
  insert into public.users (id, email)
  values (new.id, new.email);

  -- Create progress record
  insert into public.user_progress (user_id)
  values (new.id);

  -- Award 50 signup tokens
  insert into public.tokens (user_id, balance)
  values (new.id, 50);

  -- Log the signup bonus
  insert into public.token_transactions (user_id, type, amount, description, status)
  values (new.id, 'signup_bonus', 50, 'Welcome to Perfect Sand 🏆', 'completed');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- FUNCTION: recalculate_level
-- Called after streak/progress updates
-- ─────────────────────────────────────────────
create or replace function public.recalculate_level(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_streak   integer;
  v_urges    integer;
  v_days     integer;
  v_level    integer;
  v_name     text;
  v_control  integer;
begin
  select current_streak, total_urges_resisted, total_days_locked
  into v_streak, v_urges, v_days
  from public.user_progress
  where user_id = p_user_id;

  -- Control level: weighted score capped at 100
  v_control := least(100, (v_streak * 2) + (v_urges * 3) + (v_days * 4));

  -- Sand Guardian Level (1–10)
  v_level := case
    when v_control >= 95 then 10
    when v_control >= 85 then 9
    when v_control >= 75 then 8
    when v_control >= 65 then 7
    when v_control >= 55 then 6
    when v_control >= 45 then 5
    when v_control >= 35 then 4
    when v_control >= 25 then 3
    when v_control >= 15 then 2
    else 1
  end;

  v_name := case v_level
    when 10 then 'Sand Master'
    when 9  then 'Steel Guardian'
    when 8  then 'Iron Fortress'
    when 7  then 'Stone Wall'
    when 6  then 'Rising Warrior'
    when 5  then 'Steady Flame'
    when 4  then 'Building Blocks'
    when 3  then 'Sand Builder'
    when 2  then 'First Steps'
    else         'Sand Cadet'
  end;

  update public.user_progress
  set
    control_level       = v_control,
    sand_guardian_level = v_level,
    level_name          = v_name,
    updated_at          = now()
  where user_id = p_user_id;
end;
$$;
