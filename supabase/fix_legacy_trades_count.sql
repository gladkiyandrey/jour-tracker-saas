update public.tracker_entries
set trades_count = 1
where variant in ('neg', 'pos')
  and coalesce(trades_count, 0) <= 0;

