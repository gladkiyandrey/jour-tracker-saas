alter table if exists public.user_subscriptions
add column if not exists last_payment_at timestamptz;

update public.user_subscriptions
set last_payment_at = coalesce(last_payment_at, updated_at, created_at)
where true;
