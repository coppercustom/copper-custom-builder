begin;

create table public.cc_public_request_windows (
  scope text not null,
  bucket text not null,
  window_start bigint not null,
  attempts integer not null check (attempts > 0),
  primary key (scope, bucket)
);

alter table public.cc_public_request_windows enable row level security;
revoke all on public.cc_public_request_windows from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.cc_public_request_windows to service_role;

create function public.cc_allow_public_request(p_scope text, p_client_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seconds integer;
  v_global_cap integer;
  v_bucket_cap integer;
  v_bucket text;
  v_window bigint;
  v_global_count integer;
  v_global_window bigint;
  v_bucket_count integer;
begin
  if p_client_hash is not null and p_client_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid client hash' using errcode = '22023';
  end if;

  case p_scope
    when 'search' then
      v_seconds := 60;
      v_global_cap := 1200;
      v_bucket_cap := case when p_client_hash is null then 180 else 60 end;
    when 'consultation' then
      v_seconds := 300;
      v_global_cap := 120;
      v_bucket_cap := case when p_client_hash is null then 20 else 5 end;
    else
      raise exception 'Invalid limiter scope' using errcode = '22023';
  end case;

  -- Serialize within each scope, then read the clock. Concurrent calls on
  -- opposite sides of a window boundary cannot recreate expired buckets.
  perform pg_catalog.pg_advisory_xact_lock(37261044, case p_scope when 'search' then 1 else 2 end);
  v_window := floor(extract(epoch from pg_catalog.clock_timestamp()) / v_seconds);
  v_bucket := coalesce(p_client_hash, 'missing');

  select window_start, attempts into v_global_window, v_global_count
    from public.cc_public_request_windows where scope = p_scope and bucket = 'global';

  if v_global_window is distinct from v_window then
    delete from public.cc_public_request_windows where scope = p_scope;
    v_global_count := 0;
  end if;

  if v_global_count >= v_global_cap then
    return false;
  end if;

  select attempts into v_bucket_count
    from public.cc_public_request_windows where scope = p_scope and bucket = v_bucket;

  if coalesce(v_bucket_count, 0) >= v_bucket_cap then
    return false;
  end if;

  insert into public.cc_public_request_windows as w (scope, bucket, window_start, attempts)
    values (p_scope, v_bucket, v_window, 1), (p_scope, 'global', v_window, 1)
    on conflict (scope, bucket) do update set attempts = w.attempts + 1;

  return true;
end;
$$;

revoke all on function public.cc_allow_public_request(text, text) from public, anon, authenticated;
grant execute on function public.cc_allow_public_request(text, text) to service_role;

commit;
