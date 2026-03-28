-- Perfect Sand: user_stats table
-- Run this in Supabase SQL editor

create table if not exists user_stats (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  current_streak    int          not null default 0,
  longest_streak    int          not null default 0,
  last_resisted_date date,
  last_seen_date    date,
  updated_at        timestamptz  not null default now()
);

alter table user_stats enable row level security;

create policy "Users manage own stats"
  on user_stats for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
