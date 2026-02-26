create table if not exists public.premarket_journal_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  market_bias text not null default '',
  setup_focus text not null default '',
  invalidation text not null default '',
  risk_plan text not null default '',
  premarket_notes text not null default '',
  postmarket_notes text not null default '',
  charts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

create index if not exists idx_premarket_journal_entries_user_date
  on public.premarket_journal_entries (user_id, date_key desc);

