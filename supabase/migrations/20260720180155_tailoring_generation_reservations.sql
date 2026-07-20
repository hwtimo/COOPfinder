-- Tailoring-specific credit holds and atomic generated resume persistence.

create table public.tailoring_generation_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_posting_id uuid not null,
  idempotency_key uuid not null,
  state text not null default 'reserved' check (
    state in ('reserved', 'consumed', 'refunded', 'expired')
  ),
  input_fingerprint text not null check (
    input_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  provider_input_contract_version text not null check (
    provider_input_contract_version = 'tailoring-provider-input-v1'
  ),
  provider_output_contract_version text not null check (
    provider_output_contract_version = 'tailoring-plan-output-v1'
  ),
  expires_at timestamptz not null,
  resume_version_id uuid unique references public.resume_versions(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  consumed_at timestamptz,
  refunded_at timestamptz,
  expired_at timestamptz,
  constraint tailoring_generation_reservations_user_key unique (
    user_id,
    idempotency_key
  ),
  constraint tailoring_generation_reservations_id_user_key unique (
    id,
    user_id
  ),
  constraint tailoring_generation_reservations_job_owner_fkey
    foreign key (job_posting_id, user_id)
    references public.job_postings(id, user_id)
    on delete cascade,
  constraint tailoring_generation_reservations_expiration_check check (
    expires_at > created_at
  ),
  constraint tailoring_generation_reservations_state_timestamps_check check (
    (
      state = 'reserved'
      and resume_version_id is null
      and consumed_at is null
      and refunded_at is null
      and expired_at is null
    )
    or (
      state = 'consumed'
      and resume_version_id is not null
      and consumed_at is not null
      and refunded_at is null
      and expired_at is null
    )
    or (
      state = 'refunded'
      and resume_version_id is null
      and consumed_at is null
      and refunded_at is not null
      and expired_at is null
    )
    or (
      state = 'expired'
      and resume_version_id is null
      and consumed_at is null
      and refunded_at is null
      and expired_at is not null
    )
  )
);

comment on table public.tailoring_generation_reservations is
  'Owner-scoped, one-credit holds for production tailoring generation. Stores fingerprints and contract versions only; never provider input, prompts, job text, profile prose, or generated content.';

create index tailoring_generation_reservations_user_created_idx
  on public.tailoring_generation_reservations (user_id, created_at desc);

create index tailoring_generation_reservations_active_expiry_idx
  on public.tailoring_generation_reservations (user_id, expires_at)
  where state = 'reserved';

create index tailoring_generation_reservations_user_job_state_idx
  on public.tailoring_generation_reservations (
    user_id,
    job_posting_id,
    state,
    created_at
  );

alter table public.tailoring_generation_reservations enable row level security;

revoke all on table public.tailoring_generation_reservations from public;
revoke all on table public.tailoring_generation_reservations from anon;
revoke all on table public.tailoring_generation_reservations from authenticated;
grant select on table public.tailoring_generation_reservations to authenticated;

create policy "tailoring generation reservations select own"
on public.tailoring_generation_reservations
for select
to authenticated
using ((select auth.uid()) = user_id);

create table public.tailoring_generation_reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in ('reserved', 'consumed', 'refunded', 'expired')
  ),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint tailoring_generation_reservation_events_owner_fkey
    foreign key (reservation_id, user_id)
    references public.tailoring_generation_reservations(id, user_id)
    on delete cascade
);

comment on table public.tailoring_generation_reservation_events is
  'Append-only lifecycle events derived by database triggers from tailoring generation reservation transitions.';

create unique index tailoring_generation_reservation_events_reserved_idx
  on public.tailoring_generation_reservation_events (reservation_id)
  where event_type = 'reserved';

create unique index tailoring_generation_reservation_events_terminal_idx
  on public.tailoring_generation_reservation_events (reservation_id)
  where event_type in ('consumed', 'refunded', 'expired');

create index tailoring_generation_reservation_events_user_created_idx
  on public.tailoring_generation_reservation_events (user_id, created_at desc);

alter table public.tailoring_generation_reservation_events enable row level security;

revoke all on table public.tailoring_generation_reservation_events from public;
revoke all on table public.tailoring_generation_reservation_events from anon;
revoke all on table public.tailoring_generation_reservation_events from authenticated;
grant select on table public.tailoring_generation_reservation_events to authenticated;

create policy "tailoring generation reservation events select own"
on public.tailoring_generation_reservation_events
for select
to authenticated
using ((select auth.uid()) = user_id);

create function public.capture_tailoring_generation_reservation_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tailoring_generation_reservation_events (
      reservation_id,
      user_id,
      event_type,
      created_at
    ) values (
      new.id,
      new.user_id,
      'reserved',
      new.created_at
    );
  elsif old.state = 'reserved'
    and new.state in ('consumed', 'refunded', 'expired')
    and new.state is distinct from old.state
  then
    insert into public.tailoring_generation_reservation_events (
      reservation_id,
      user_id,
      event_type,
      created_at
    ) values (
      new.id,
      new.user_id,
      new.state,
      coalesce(new.consumed_at, new.refunded_at, new.expired_at)
    );
  end if;

  return new;
end;
$$;

revoke all on function public.capture_tailoring_generation_reservation_event() from public;
revoke all on function public.capture_tailoring_generation_reservation_event() from anon;
revoke all on function public.capture_tailoring_generation_reservation_event() from authenticated;
revoke all on function public.capture_tailoring_generation_reservation_event() from service_role;

create trigger tailoring_generation_reservation_events_after_insert
after insert on public.tailoring_generation_reservations
for each row
execute function public.capture_tailoring_generation_reservation_event();

create trigger tailoring_generation_reservation_events_after_state_update
after update of state on public.tailoring_generation_reservations
for each row
execute function public.capture_tailoring_generation_reservation_event();

create function public.expire_tailoring_generation_reservations(
  p_user_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
begin
  update public.tailoring_generation_reservations as reservation
  set
    state = 'expired',
    expired_at = pg_catalog.statement_timestamp(),
    updated_at = pg_catalog.statement_timestamp()
  where reservation.user_id = p_user_id
    and reservation.state = 'reserved'
    and reservation.expires_at <= pg_catalog.statement_timestamp();

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

revoke all on function public.expire_tailoring_generation_reservations(uuid) from public;
revoke all on function public.expire_tailoring_generation_reservations(uuid) from anon;
revoke all on function public.expire_tailoring_generation_reservations(uuid) from authenticated;
revoke all on function public.expire_tailoring_generation_reservations(uuid) from service_role;

create function public.reserve_tailoring_generation_credit(
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
    or p_provider_input_contract_version <> 'tailoring-provider-input-v1'
    or p_provider_output_contract_version <> 'tailoring-plan-output-v1'
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
    user_id,
    job_posting_id,
    idempotency_key,
    input_fingerprint,
    provider_input_contract_version,
    provider_output_contract_version,
    expires_at
  ) values (
    v_user_id,
    p_job_posting_id,
    p_idempotency_key,
    p_input_fingerprint,
    p_provider_input_contract_version,
    p_provider_output_contract_version,
    v_expires_at
  ) returning id into v_reservation_id;

  return query select 'reserved'::text, v_reservation_id, null::uuid, v_expires_at;
end;
$$;

revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from public;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from anon;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from service_role;
grant execute on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) to authenticated;

create function public.refund_tailoring_generation_reservation(
  p_reservation_id uuid
) returns table (
  result_status text,
  reservation_id uuid,
  resume_version_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.tailoring_generation_reservations%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if p_reservation_id is null then
    return query select 'invalid_input'::text, null::uuid, null::uuid;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );
  perform public.expire_tailoring_generation_reservations(v_user_id);

  select reservation.*
  into v_reservation
  from public.tailoring_generation_reservations as reservation
  where reservation.id = p_reservation_id
    and reservation.user_id = v_user_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid;
    return;
  end if;

  case v_reservation.state
    when 'reserved' then
      update public.tailoring_generation_reservations as reservation
      set state = 'refunded', refunded_at = pg_catalog.statement_timestamp(), updated_at = pg_catalog.statement_timestamp()
      where reservation.id = v_reservation.id and reservation.user_id = v_user_id;
      return query select 'refunded'::text, v_reservation.id, null::uuid;
    when 'refunded' then
      return query select 'already_refunded'::text, v_reservation.id, null::uuid;
    when 'expired' then
      return query select 'expired'::text, v_reservation.id, null::uuid;
    when 'consumed' then
      return query select 'already_completed'::text, v_reservation.id, v_reservation.resume_version_id;
    else
      return query select 'invalid_input'::text, null::uuid, null::uuid;
  end case;
end;
$$;

revoke all on function public.refund_tailoring_generation_reservation(uuid) from public;
revoke all on function public.refund_tailoring_generation_reservation(uuid) from anon;
revoke all on function public.refund_tailoring_generation_reservation(uuid) from service_role;
grant execute on function public.refund_tailoring_generation_reservation(uuid) to authenticated;

create function public.is_valid_tailoring_plan_output_v1(
  p_plan jsonb
) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_section jsonb;
  v_item jsonb;
  v_reference jsonb;
  v_reference_id text;
  v_section_type text;
  v_seen_references text[] := array[]::text[];
  v_seen_sections text[] := array[]::text[];
begin
  if p_plan is null or pg_catalog.jsonb_typeof(p_plan) <> 'object' then return false; end if;

  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_plan)) <> 3
    or exists (select 1 from pg_catalog.jsonb_object_keys(p_plan) as keys(key_name) where key_name not in ('contractVersion', 'summaryEvidenceIds', 'sections'))
    or p_plan ->> 'contractVersion' <> 'tailoring-plan-output-v1'
    or pg_catalog.jsonb_typeof(p_plan -> 'summaryEvidenceIds') <> 'array'
    or pg_catalog.jsonb_typeof(p_plan -> 'sections') <> 'array'
    or pg_catalog.jsonb_array_length(p_plan -> 'summaryEvidenceIds') > 8
    or pg_catalog.jsonb_array_length(p_plan -> 'sections') > 6
  then return false; end if;

  for v_reference in select value from pg_catalog.jsonb_array_elements(p_plan -> 'summaryEvidenceIds') loop
    if pg_catalog.jsonb_typeof(v_reference) <> 'string' then return false; end if;
    v_reference_id := v_reference #>> '{}';
    if v_reference_id !~ '^ev_[0-9]{3}$' or v_reference_id = any(v_seen_references) then return false; end if;
    v_seen_references := pg_catalog.array_append(v_seen_references, v_reference_id);
  end loop;

  for v_section in select value from pg_catalog.jsonb_array_elements(p_plan -> 'sections') loop
    if pg_catalog.jsonb_typeof(v_section) <> 'object'
      or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_section)) <> 2
      or exists (select 1 from pg_catalog.jsonb_object_keys(v_section) as keys(key_name) where key_name not in ('type', 'items'))
      or pg_catalog.jsonb_typeof(v_section -> 'type') <> 'string'
      or pg_catalog.jsonb_typeof(v_section -> 'items') <> 'array'
      or pg_catalog.jsonb_array_length(v_section -> 'items') < 1
      or pg_catalog.jsonb_array_length(v_section -> 'items') > 12
    then return false; end if;

    v_section_type := v_section ->> 'type';
    if v_section_type not in ('general_skills', 'technologies', 'soft_skills', 'certifications', 'languages', 'supporting_evidence')
      or v_section_type = any(v_seen_sections)
    then return false; end if;
    v_seen_sections := pg_catalog.array_append(v_seen_sections, v_section_type);

    for v_item in select value from pg_catalog.jsonb_array_elements(v_section -> 'items') loop
      if pg_catalog.jsonb_typeof(v_item) <> 'object'
        or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_item)) <> 1
        or not (v_item ? 'evidenceId')
        or pg_catalog.jsonb_typeof(v_item -> 'evidenceId') <> 'string'
      then return false; end if;
      v_reference_id := v_item ->> 'evidenceId';
      if v_reference_id !~ '^ev_[0-9]{3}$' or v_reference_id = any(v_seen_references) then return false; end if;
      v_seen_references := pg_catalog.array_append(v_seen_references, v_reference_id);
    end loop;
  end loop;

  return true;
exception when others then return false;
end;
$$;

revoke all on function public.is_valid_tailoring_plan_output_v1(jsonb) from public;
revoke all on function public.is_valid_tailoring_plan_output_v1(jsonb) from anon;
revoke all on function public.is_valid_tailoring_plan_output_v1(jsonb) from authenticated;
revoke all on function public.is_valid_tailoring_plan_output_v1(jsonb) from service_role;

create unique index tailoring_credit_ledger_generation_reservation_ref_idx
  on public.tailoring_credit_ledger (user_id, ref)
  where reason = 'tailor_generation'
    and ref like 'tailoring_generation_reservation:%';

create function public.finalize_tailoring_generation(
  p_reservation_id uuid,
  p_input_fingerprint text,
  p_provider_input_contract_version text,
  p_provider_output_contract_version text,
  p_plan jsonb
) returns table (
  result_status text,
  reservation_id uuid,
  resume_version_id uuid,
  version_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.tailoring_generation_reservations%rowtype;
  v_job_title text;
  v_version_number integer;
  v_version_name text;
  v_resume_version_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if p_reservation_id is null
    or p_input_fingerprint is null
    or p_input_fingerprint !~ '^[0-9a-f]{64}$'
    or p_provider_input_contract_version <> 'tailoring-provider-input-v1'
    or p_provider_output_contract_version <> 'tailoring-plan-output-v1'
    or p_plan is null
  then
    return query select 'invalid_input'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  perform public.expire_tailoring_generation_reservations(v_user_id);

  select reservation.* into v_reservation
  from public.tailoring_generation_reservations as reservation
  where reservation.id = p_reservation_id and reservation.user_id = v_user_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if v_reservation.input_fingerprint <> p_input_fingerprint
    or v_reservation.provider_input_contract_version <> p_provider_input_contract_version
    or v_reservation.provider_output_contract_version <> p_provider_output_contract_version
  then
    return query select 'invalid_input'::text, v_reservation.id, null::uuid, null::text;
    return;
  end if;

  case v_reservation.state
    when 'consumed' then
      select version.name into v_version_name
      from public.resume_versions as version
      where version.id = v_reservation.resume_version_id and version.user_id = v_user_id;
      return query select 'already_completed'::text, v_reservation.id, v_reservation.resume_version_id, v_version_name;
      return;
    when 'refunded' then
      return query select 'terminal_refunded'::text, v_reservation.id, null::uuid, null::text;
      return;
    when 'expired' then
      return query select 'expired'::text, v_reservation.id, null::uuid, null::text;
      return;
    when 'reserved' then null;
    else
      return query select 'invalid_input'::text, v_reservation.id, null::uuid, null::text;
      return;
  end case;

  select coalesce(nullif(pg_catalog.btrim(pg_catalog.regexp_replace(job.title, '\s+', ' ', 'g')), ''), 'Private job')
  into v_job_title
  from public.job_postings as job
  where job.id = v_reservation.job_posting_id and job.user_id = v_user_id
  for key share;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if not public.is_valid_tailoring_plan_output_v1(p_plan) then
    return query select 'invalid_output'::text, v_reservation.id, null::uuid, null::text;
    return;
  end if;

  select pg_catalog.count(*)::integer + 1 into v_version_number
  from public.tailoring_generation_reservations as reservation
  where reservation.user_id = v_user_id
    and reservation.job_posting_id = v_reservation.job_posting_id
    and reservation.state = 'consumed';

  v_version_name := pg_catalog.format(
    '%s - tailored v%s - %s',
    pg_catalog.left(v_job_title, 160),
    v_version_number,
    v_reservation.id::text
  );

  insert into public.resume_versions (
    user_id, job_posting_id, name, focus, base_version_name, content, keyword_report, notes
  ) values (
    v_user_id, v_reservation.job_posting_id, v_version_name, null, null, p_plan, '{}'::jsonb, null
  ) returning id into v_resume_version_id;

  insert into public.tailoring_credit_ledger (user_id, amount, reason, ref, metadata)
  values (
    v_user_id,
    -1,
    'tailor_generation',
    'tailoring_generation_reservation:' || v_reservation.id::text,
    pg_catalog.jsonb_build_object(
      'source', 'tailoring_generation_reservation',
      'resume_version_id', v_resume_version_id
    )
  );

  update public.tailoring_generation_reservations as reservation
  set state = 'consumed', resume_version_id = v_resume_version_id,
      consumed_at = pg_catalog.statement_timestamp(), updated_at = pg_catalog.statement_timestamp()
  where reservation.id = v_reservation.id and reservation.user_id = v_user_id;

  return query select 'finalized'::text, v_reservation.id, v_resume_version_id, v_version_name;
end;
$$;

revoke all on function public.finalize_tailoring_generation(uuid, text, text, text, jsonb) from public;
revoke all on function public.finalize_tailoring_generation(uuid, text, text, text, jsonb) from anon;
revoke all on function public.finalize_tailoring_generation(uuid, text, text, text, jsonb) from service_role;
grant execute on function public.finalize_tailoring_generation(uuid, text, text, text, jsonb) to authenticated;
