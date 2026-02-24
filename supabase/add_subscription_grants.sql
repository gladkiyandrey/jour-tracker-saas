create table if not exists public.subscription_grants (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  granted_by_user_id uuid not null references auth.users(id) on delete cascade,
  days integer not null check (days in (1, 7, 30)),
  reason text,
  expires_at_after timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_grants_target_created
  on public.subscription_grants (target_user_id, created_at desc);

create index if not exists idx_subscription_grants_admin_created
  on public.subscription_grants (granted_by_user_id, created_at desc);
