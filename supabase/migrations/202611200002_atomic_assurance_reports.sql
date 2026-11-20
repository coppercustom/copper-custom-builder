create table public.cc_atomic_assurance_reports (
  consultation_id uuid primary key references public.cc_consultations(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  build_reference text not null default '' check (length(build_reference) <= 120),
  prepared_by text not null default '' check (length(prepared_by) <= 120),
  pickup_date date,
  warranty_end_date date,
  test_date date,
  inspection_summary text not null default '' check (length(inspection_summary) <= 2000),
  test_summary text not null default '' check (length(test_summary) <= 2000),
  sound_reading_db numeric check (sound_reading_db between 0 and 250),
  torque_url text not null default '',
  witness_url text not null default '',
  footage_url text not null default '',
  target_url text not null default '',
  check (warranty_end_date >= pickup_date),
  check (length(torque_url) <= 2048 and (torque_url = '' or torque_url ~ '^https://[^[:space:]]+$')),
  check (length(witness_url) <= 2048 and (witness_url = '' or witness_url ~ '^https://[^[:space:]]+$')),
  check (length(footage_url) <= 2048 and (footage_url = '' or footage_url ~ '^https://[^[:space:]]+$')),
  check (length(target_url) <= 2048 and (target_url = '' or target_url ~ '^https://[^[:space:]]+$'))
);

alter table public.cc_atomic_assurance_reports enable row level security;
revoke all on public.cc_atomic_assurance_reports from public, anon, authenticated;
grant select, insert on public.cc_atomic_assurance_reports to authenticated;
grant update (revision, build_reference, prepared_by, pickup_date, warranty_end_date,
              test_date, inspection_summary, test_summary, sound_reading_db,
              torque_url, witness_url, footage_url, target_url)
on public.cc_atomic_assurance_reports to authenticated;

create policy cc_atomic_assurance_reports_active_staff
on public.cc_atomic_assurance_reports for all to authenticated
using (
  exists (select 1 from public.cc_staff
          where user_id = (select auth.uid()) and active)
)
with check (
  exists (select 1 from public.cc_staff
          where user_id = (select auth.uid()) and active)
  and exists (select 1 from public.cc_consultations
              where id = consultation_id and trashed_at is null
                and answers @> '{"documentation_package_requested":true}'::jsonb)
);
