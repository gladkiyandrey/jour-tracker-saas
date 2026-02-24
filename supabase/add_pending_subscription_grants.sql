create table if not exists public.pending_subscription_grants (
  email text primary key,
  granted_by_user_id uuid not null references auth.users(id) on delete cascade,
  days integer not null check (days in (1, 7, 30)),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pending_subscription_grants_admin_created
  on public.pending_subscription_grants (granted_by_user_id, created_at desc);

alter table if exists public.pending_subscription_grants enable row level security;

-- Access only from backend with service role; no client-side policies.
