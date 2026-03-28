-- Add user_plan to user_stats
-- Run in Supabase SQL editor after user_stats.sql

alter table user_stats
  add column if not exists user_plan text not null default 'free'
  check (user_plan in ('free', 'premium'));
