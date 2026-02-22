alter table public.tracker_entries
add column if not exists trades_count integer not null default 0;

alter table public.tracker_entries
drop constraint if exists tracker_entries_trades_count_check;

alter table public.tracker_entries
add constraint tracker_entries_trades_count_check check (trades_count >= 0);

