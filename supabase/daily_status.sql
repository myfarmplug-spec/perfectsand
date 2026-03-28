-- Add daily engagement fields to user_stats
-- Run in Supabase SQL editor after user_stats.sql

alter table user_stats
  add column if not exists daily_status      text  default 'unknown'
    check (daily_status in ('unknown', 'controlled', 'slipped')),
  add column if not exists daily_status_date date;
