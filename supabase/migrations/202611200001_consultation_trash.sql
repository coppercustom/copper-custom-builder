-- Preserve consultation status, assignments, notes and customer answers.
-- The existing staff SELECT and UPDATE policies also cover this column.
alter table public.cc_consultations
  add column if not exists trashed_at timestamptz;

create index if not exists cc_consultations_trash_recent_idx
  on public.cc_consultations (trashed_at desc)
  where trashed_at is not null;
