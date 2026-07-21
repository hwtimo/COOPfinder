-- Reduce future signup grants and bound new tailoring provider attempts.

create or replace function public.grant_signup_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tailoring_credit_ledger (
    user_id,
    amount,
    reason,
    metadata
  ) values (
    new.user_id,
    1,
    'signup_grant',
    pg_catalog.jsonb_build_object('source', 'profiles_after_insert')
  )
  on conflict do nothing;

  return new;
end;
$$;

comment on function public.grant_signup_credits() is
  'Appends exactly one tailoring credit for a newly created profile without rewriting historical ledger entries.';

revoke all on function public.grant_signup_credits() from public;
revoke all on function public.grant_signup_credits() from anon;
revoke all on function public.grant_signup_credits() from authenticated;
revoke all on function public.grant_signup_credits() from service_role;

create or replace function public.reserve_tailoring_generation_credit(
  p_job_posting_id uuid,
  p_idempotency_key uuid,
  p_input_fingerprint text,
  p_provider_input_contract_version text,
  p_provider_output_contract_version text
) returns table (
  result_status text,
  reservation_id uuid,
  resume_version_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.tailoring_generation_reservations%rowtype;
  v_attempt_count integer;
  v_balance integer;
  v_active_holds integer;
  v_reservation_id uuid;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if p_job_posting_id is null
    or p_idempotency_key is null
    or p_input_fingerprint is null
    or p_input_fingerprint !~ '^[0-9a-f]{64}$'
    or not (
      (
        p_provider_input_contract_version = 'tailoring-provider-input-v1'
        and p_provider_output_contract_version = 'tailoring-plan-output-v1'
      )
      or (
        p_provider_input_contract_version = 'tailoring-provider-input-v2'
        and p_provider_output_contract_version = 'tailoring-plan-output-v2'
      )
    )
  then
    return query select 'invalid_input'::text, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  perform 1
  from public.job_postings as job
  where job.id = p_job_posting_id
    and job.user_id = v_user_id
  for key share;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;

  perform public.expire_tailoring_generation_reservations(v_user_id);

  select reservation.*
  into v_existing
  from public.tailoring_generation_reservations as reservation
  where reservation.user_id = v_user_id
    and reservation.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.job_posting_id <> p_job_posting_id
      or v_existing.input_fingerprint <> p_input_fingerprint
      or v_existing.provider_input_contract_version <> p_provider_input_contract_version
      or v_existing.provider_output_contract_version <> p_provider_output_contract_version
    then
      return query select 'invalid_input'::text, null::uuid, null::uuid, null::timestamptz;
      return;
    end if;

    case v_existing.state
      when 'consumed' then
        return query select 'already_completed'::text, v_existing.id, v_existing.resume_version_id, v_existing.expires_at;
      when 'reserved' then
        return query select 'generation_in_progress'::text, v_existing.id, null::uuid, v_existing.expires_at;
      when 'refunded' then
        return query select 'terminal_refunded'::text, v_existing.id, null::uuid, v_existing.expires_at;
      when 'expired' then
        return query select 'terminal_expired'::text, v_existing.id, null::uuid, v_existing.expires_at;
      else
        return query select 'invalid_input'::text, null::uuid, null::uuid, null::timestamptz;
    end case;
    return;
  end if;

  select pg_catalog.count(*)::integer
  into v_attempt_count
  from public.tailoring_generation_reservations as reservation
  where reservation.user_id = v_user_id
    and reservation.created_at >= pg_catalog.statement_timestamp() - interval '24 hours';

  if v_attempt_count >= 2 then
    return query select 'rate_limited'::text, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;

  select coalesce(pg_catalog.sum(ledger.amount), 0)::integer
  into v_balance
  from public.tailoring_credit_ledger as ledger
  where ledger.user_id = v_user_id;

  select pg_catalog.count(*)::integer
  into v_active_holds
  from public.tailoring_generation_reservations as reservation
  where reservation.user_id = v_user_id
    and reservation.state = 'reserved'
    and reservation.expires_at > pg_catalog.statement_timestamp();

  if v_balance - v_active_holds < 1 then
    return query select 'insufficient_credit'::text, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;

  v_expires_at := pg_catalog.statement_timestamp() + interval '10 minutes';

  insert into public.tailoring_generation_reservations (
    user_id, job_posting_id, idempotency_key, input_fingerprint,
    provider_input_contract_version, provider_output_contract_version,
    expires_at
  ) values (
    v_user_id, p_job_posting_id, p_idempotency_key, p_input_fingerprint,
    p_provider_input_contract_version, p_provider_output_contract_version,
    v_expires_at
  ) returning id into v_reservation_id;

  return query select 'reserved'::text, v_reservation_id, null::uuid, v_expires_at;
end;
$$;

comment on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) is
  'Atomically reserves one owner-scoped tailoring credit and permits at most two new provider attempts per user in a rolling 24-hour period; idempotent replays do not create attempts.';

revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from public;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from anon;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from authenticated;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from service_role;
