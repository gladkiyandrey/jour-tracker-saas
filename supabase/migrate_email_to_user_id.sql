alter table if exists public.tracker_entries add column if not exists user_id uuid;
update public.tracker_entries t
set user_id = u.id
from auth.users u
where t.user_id is null
  and lower(t.user_email) = lower(u.email);

delete from public.tracker_entries where user_id is null;

alter table public.tracker_entries drop constraint if exists tracker_entries_pkey;
alter table public.tracker_entries alter column user_id set not null;
alter table public.tracker_entries add constraint tracker_entries_pkey primary key (user_id, date_key);
alter table public.tracker_entries add constraint tracker_entries_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
drop index if exists idx_tracker_entries_user;
create index if not exists idx_tracker_entries_user on public.tracker_entries (user_id);
alter table public.tracker_entries drop column if exists user_email;

alter table if exists public.user_subscriptions add column if not exists user_id uuid;
update public.user_subscriptions s
set user_id = u.id
from auth.users u
where s.user_id is null
  and lower(s.user_email) = lower(u.email);

delete from public.user_subscriptions where user_id is null;

alter table public.user_subscriptions drop constraint if exists user_subscriptions_pkey;
alter table public.user_subscriptions alter column user_id set not null;
alter table public.user_subscriptions add constraint user_subscriptions_pkey primary key (user_id);
alter table public.user_subscriptions add constraint user_subscriptions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.user_subscriptions drop column if exists user_email;

