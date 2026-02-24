create table if not exists public.tracker_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  result smallint not null check (result in (-1, 1)),
  variant text not null check (variant in ('neg', 'pos', 'pos-outline')),
  deposit numeric(14, 2) not null default 0,
  trades_count integer not null default 0 check (trades_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'inactive', 'past_due', 'canceled')),
  expires_at timestamptz,
  plan_code text,
  provider text default 'mock',
  provider_customer_id text,
  provider_subscription_id text,
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tracker_entries_user on public.tracker_entries (user_id);
create index if not exists idx_subscriptions_status on public.user_subscriptions (status);

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

create index if not exists idx_share_snapshots_user_created on public.share_snapshots (user_id, created_at desc);

create table if not exists public.subscription_grants (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  granted_by_user_id uuid not null references auth.users(id) on delete cascade,
  days integer not null check (days in (1, 7, 30)),
  reason text,
  expires_at_after timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_grants_target_created on public.subscription_grants (target_user_id, created_at desc);
create index if not exists idx_subscription_grants_admin_created on public.subscription_grants (granted_by_user_id, created_at desc);

alter table public.tracker_entries enable row level security;
alter table public.user_subscriptions enable row level security;

drop policy if exists "tracker_select_own" on public.tracker_entries;
drop policy if exists "tracker_insert_own" on public.tracker_entries;
drop policy if exists "tracker_update_own" on public.tracker_entries;
drop policy if exists "tracker_delete_own" on public.tracker_entries;
drop policy if exists "subscription_select_own" on public.user_subscriptions;

create policy "tracker_select_own"
  on public.tracker_entries
  for select
  using (auth.uid() = user_id);

create policy "tracker_insert_own"
  on public.tracker_entries
  for insert
  with check (auth.uid() = user_id);

create policy "tracker_update_own"
  on public.tracker_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tracker_delete_own"
  on public.tracker_entries
  for delete
  using (auth.uid() = user_id);

create policy "subscription_select_own"
  on public.user_subscriptions
  for select
  using (auth.uid() = user_id);
