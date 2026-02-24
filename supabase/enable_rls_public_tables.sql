-- Enable RLS on public tables flagged by Supabase Security Advisor
alter table if exists public.share_snapshots enable row level security;
alter table if exists public.push_subscriptions enable row level security;
alter table if exists public.subscription_grants enable row level security;

-- share_snapshots: owner can read/insert/update/delete own rows
drop policy if exists "share_select_own" on public.share_snapshots;
drop policy if exists "share_insert_own" on public.share_snapshots;
drop policy if exists "share_update_own" on public.share_snapshots;
drop policy if exists "share_delete_own" on public.share_snapshots;

create policy "share_select_own"
  on public.share_snapshots
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "share_insert_own"
  on public.share_snapshots
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "share_update_own"
  on public.share_snapshots
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "share_delete_own"
  on public.share_snapshots
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- push_subscriptions: owner can read/insert/update/delete own rows
drop policy if exists "push_select_own" on public.push_subscriptions;
drop policy if exists "push_insert_own" on public.push_subscriptions;
drop policy if exists "push_update_own" on public.push_subscriptions;
drop policy if exists "push_delete_own" on public.push_subscriptions;

create policy "push_select_own"
  on public.push_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "push_insert_own"
  on public.push_subscriptions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "push_update_own"
  on public.push_subscriptions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "push_delete_own"
  on public.push_subscriptions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- subscription_grants:
-- No authenticated client policies on purpose.
-- Access is done by backend via service role key only.
