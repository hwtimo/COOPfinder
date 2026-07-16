-- Atomic, per-account credits and rolling provider-attempt limits for pasted-JD analysis.

create table public.parser_analysis_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_posting_id uuid not null,
  state text not null default 'reserved' check (
    state in ('reserved', 'consumed', 'refunded')
  ),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  constraint parser_analysis_credit_reservations_finalization_check check (
    (state = 'reserved' and finalized_at is null)
    or (state in ('consumed', 'refunded') and finalized_at is not null)
  )
);

comment on table public.parser_analysis_credit_reservations is
  'Server-controlled reservation ledger for pasted-JD analysis credits and provider-attempt accounting. It stores no job text, extraction data, provider output, model information, credentials, or errors.';

create index parser_analysis_credit_reservations_user_created_at_idx
  on public.parser_analysis_credit_reservations (user_id, created_at desc);

create index parser_analysis_credit_reservations_active_user_idx
  on public.parser_analysis_credit_reservations (user_id)
  where state in ('reserved', 'consumed');

alter table public.parser_analysis_credit_reservations enable row level security;

revoke all on table public.parser_analysis_credit_reservations from public;
revoke all on table public.parser_analysis_credit_reservations from anon;
grant select on table public.parser_analysis_credit_reservations to authenticated;

create policy "parser analysis credit reservations select own"
on public.parser_analysis_credit_reservations
for select
to authenticated
using ((select auth.uid()) = user_id);

create function public.reserve_parser_analysis_credit(
  p_job_posting_id uuid
) returns table (
  result_status text,
  reservation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_intake_source text;
  v_raw_text text;
  v_attempt_count integer;
  v_active_credit_count integer;
  v_reservation_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication required';
  end if;

  if p_job_posting_id is null then
    return query select 'invalid_input'::text, null::uuid;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select job.intake_source, job.raw_text
  into v_intake_source, v_raw_text
  from public.job_postings as job
  where job.id = p_job_posting_id
    and job.user_id = v_user_id
  for key share;

  if not found then
    return query select 'unavailable'::text, null::uuid;
    return;
  end if;

  if v_intake_source <> 'pasted_text' then
    return query select 'unsupported_source'::text, null::uuid;
    return;
  end if;

  if v_raw_text is null or pg_catalog.btrim(v_raw_text) = '' then
    return query select 'invalid_input'::text, null::uuid;
    return;
  end if;

  select pg_catalog.count(*)::integer
  into v_attempt_count
  from public.parser_analysis_credit_reservations as reservation
  where reservation.user_id = v_user_id
    and reservation.created_at >= pg_catalog.statement_timestamp() - interval '24 hours';

  if v_attempt_count >= 3 then
    return query select 'daily_limit'::text, null::uuid;
    return;
  end if;

  select pg_catalog.count(*)::integer
  into v_active_credit_count
  from public.parser_analysis_credit_reservations as reservation
  where reservation.user_id = v_user_id
    and reservation.state in ('reserved', 'consumed');

  if v_active_credit_count >= 2 then
    return query select 'no_credits'::text, null::uuid;
    return;
  end if;

  insert into public.parser_analysis_credit_reservations (
    user_id,
    job_posting_id
  ) values (
    v_user_id,
    p_job_posting_id
  ) returning id into v_reservation_id;

  return query select 'reserved'::text, v_reservation_id;
end;
$$;

comment on function public.reserve_parser_analysis_credit(uuid) is
  'Atomically reserves one of two lifetime pasted-JD analysis credits and one rolling 24-hour provider attempt for a caller-owned pasted-text job.';

revoke all on function public.reserve_parser_analysis_credit(uuid) from public;
revoke all on function public.reserve_parser_analysis_credit(uuid) from anon;
grant execute on function public.reserve_parser_analysis_credit(uuid) to authenticated;

create function public.finalize_parser_analysis_credit(
  p_reservation_id uuid,
  p_succeeded boolean
) returns table (
  result_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_state text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication required';
  end if;

  if p_reservation_id is null or p_succeeded is null then
    return query select 'invalid_input'::text;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select reservation.state
  into v_state
  from public.parser_analysis_credit_reservations as reservation
  where reservation.id = p_reservation_id
    and reservation.user_id = v_user_id
  for update;

  if not found then
    return query select 'unavailable'::text;
    return;
  end if;

  if v_state = 'reserved' then
    update public.parser_analysis_credit_reservations as reservation
    set
      state = case when p_succeeded then 'consumed' else 'refunded' end,
      finalized_at = pg_catalog.statement_timestamp()
    where reservation.id = p_reservation_id
      and reservation.user_id = v_user_id;

    v_state := case when p_succeeded then 'consumed' else 'refunded' end;
  end if;

  return query select v_state;
end;
$$;

comment on function public.finalize_parser_analysis_credit(uuid, boolean) is
  'Atomically finalizes a caller-owned pasted-JD analysis reservation as consumed on success or refunded on failure; repeated calls return the original terminal state.';

revoke all on function public.finalize_parser_analysis_credit(uuid, boolean) from public;
revoke all on function public.finalize_parser_analysis_credit(uuid, boolean) from anon;
grant execute on function public.finalize_parser_analysis_credit(uuid, boolean) to authenticated;
