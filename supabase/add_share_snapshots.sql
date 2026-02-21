create table if not exists public.share_snapshots (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month >= 0 and month <= 11),
  score integer not null check (score >= 0 and score <= 100),
  green_streak integer not null default 0,
  red_streak integer not null default 0,
  chart_yellow text not null default '',
  chart_blue text not null default '',
  days jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_share_snapshots_user_created
  on public.share_snapshots (user_id, created_at desc);
