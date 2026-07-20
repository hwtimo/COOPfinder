-- Persist only complete v2 tailored-resume documents for new generations.

alter table public.tailoring_generation_reservations
  drop constraint tailoring_generation_reserva_provider_input_contract_vers_check,
  drop constraint tailoring_generation_reserva_provider_output_contract_ver_check;

alter table public.tailoring_generation_reservations
  add constraint tailoring_generation_reservations_contract_versions_check check (
    (
      provider_input_contract_version = 'tailoring-provider-input-v1'
      and provider_output_contract_version = 'tailoring-plan-output-v1'
    )
    or (
      provider_input_contract_version = 'tailoring-provider-input-v2'
      and provider_output_contract_version = 'tailoring-plan-output-v2'
    )
  );

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

revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from public;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from anon;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from authenticated;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from service_role;

create function public.jsonb_object_has_exact_keys(
  p_value jsonb,
  p_keys text[]
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p_value) = 'object'
    and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_value)) = pg_catalog.cardinality(p_keys)
    and not exists (
      select 1
      from pg_catalog.jsonb_object_keys(p_value) as keys(key_name)
      where not (keys.key_name = any(p_keys))
    );
$$;

create function public.is_normalized_bounded_string(
  p_value jsonb,
  p_minimum integer,
  p_maximum integer
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p_value) = 'string'
    and pg_catalog.length(p_value #>> '{}') between p_minimum and p_maximum
    and pg_catalog.btrim(pg_catalog.regexp_replace(p_value #>> '{}', '\s+', ' ', 'g')) = p_value #>> '{}';
$$;

create function public.is_valid_tailoring_plan_output_v2(
  p_plan jsonb
) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_section jsonb;
  v_entry jsonb;
  v_id_value jsonb;
  v_id text;
  v_section_type text;
  v_seen_sections text[] := array[]::text[];
  v_seen_entries text[] := array[]::text[];
  v_seen_fragments text[] := array[]::text[];
  v_seen_evidence text[] := array[]::text[];
begin
  if not public.jsonb_object_has_exact_keys(p_plan, array['contractVersion', 'sections'])
    or p_plan ->> 'contractVersion' <> 'tailoring-plan-output-v2'
    or pg_catalog.jsonb_typeof(p_plan -> 'sections') <> 'array'
    or pg_catalog.jsonb_array_length(p_plan -> 'sections') not between 1 and 8
  then return false; end if;

  for v_section in select value from pg_catalog.jsonb_array_elements(p_plan -> 'sections') loop
    if not public.jsonb_object_has_exact_keys(v_section, array['type', 'entries', 'evidenceIds'])
      or pg_catalog.jsonb_typeof(v_section -> 'type') <> 'string'
      or pg_catalog.jsonb_typeof(v_section -> 'entries') <> 'array'
      or pg_catalog.jsonb_typeof(v_section -> 'evidenceIds') <> 'array'
      or pg_catalog.jsonb_array_length(v_section -> 'entries') > 20
      or pg_catalog.jsonb_array_length(v_section -> 'evidenceIds') > 100
    then return false; end if;
    v_section_type := v_section ->> 'type';
    if v_section_type not in ('education', 'experience', 'project', 'skills', 'technologies', 'certifications', 'languages', 'volunteer')
      or v_section_type = any(v_seen_sections)
      or (v_section_type <> 'education' and pg_catalog.jsonb_array_length(v_section -> 'entries') = 0 and pg_catalog.jsonb_array_length(v_section -> 'evidenceIds') = 0)
    then return false; end if;
    v_seen_sections := pg_catalog.array_append(v_seen_sections, v_section_type);

    for v_entry in select value from pg_catalog.jsonb_array_elements(v_section -> 'entries') loop
      if not public.jsonb_object_has_exact_keys(v_entry, array['entryId', 'fragmentIds'])
        or not public.is_normalized_bounded_string(v_entry -> 'entryId', 1, 32)
        or (v_entry ->> 'entryId') !~ '^entry_[0-9]{3}$'
        or pg_catalog.jsonb_typeof(v_entry -> 'fragmentIds') <> 'array'
        or pg_catalog.jsonb_array_length(v_entry -> 'fragmentIds') not between 1 and 20
        or (v_entry ->> 'entryId') = any(v_seen_entries)
      then return false; end if;
      v_seen_entries := pg_catalog.array_append(v_seen_entries, v_entry ->> 'entryId');
      for v_id_value in select value from pg_catalog.jsonb_array_elements(v_entry -> 'fragmentIds') loop
        if not public.is_normalized_bounded_string(v_id_value, 1, 32) then return false; end if;
        v_id := v_id_value #>> '{}';
        if v_id !~ '^fragment_[0-9]{3}_[0-9]{3}$' or v_id = any(v_seen_fragments) then return false; end if;
        v_seen_fragments := pg_catalog.array_append(v_seen_fragments, v_id);
      end loop;
    end loop;

    for v_id_value in select value from pg_catalog.jsonb_array_elements(v_section -> 'evidenceIds') loop
      if not public.is_normalized_bounded_string(v_id_value, 1, 32) then return false; end if;
      v_id := v_id_value #>> '{}';
      if v_id !~ '^(skill|technology|certification|language)_[0-9]{3}$' or v_id = any(v_seen_evidence) then return false; end if;
      if (v_id like 'skill_%' and v_section_type <> 'skills')
        or (v_id like 'technology_%' and v_section_type <> 'technologies')
        or (v_id like 'certification_%' and v_section_type <> 'certifications')
        or (v_id like 'language_%' and v_section_type <> 'languages')
      then return false; end if;
      v_seen_evidence := pg_catalog.array_append(v_seen_evidence, v_id);
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;

create function public.is_valid_tailored_resume_version_content_v2(
  p_content jsonb
) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_job jsonb;
  v_document jsonb;
  v_identity jsonb;
  v_education jsonb;
  v_selected jsonb;
  v_section jsonb;
  v_plan_section jsonb;
  v_entry jsonb;
  v_bullet jsonb;
  v_evidence jsonb;
  v_source jsonb;
  v_index integer := 0;
  v_section_type text;
  v_category text;
  v_plan_fragment_refs jsonb := '[]'::jsonb;
  v_document_fragment_refs jsonb := '[]'::jsonb;
  v_plan_evidence_refs jsonb := '[]'::jsonb;
  v_document_evidence_refs jsonb := '[]'::jsonb;
  v_document_fragments jsonb := '[]'::jsonb;
  v_document_evidence jsonb := '[]'::jsonb;
begin
  if not public.jsonb_object_has_exact_keys(
      p_content,
      array['contractVersion', 'providerInputContractVersion', 'providerOutputContractVersion', 'sourceFingerprint', 'job', 'plan', 'document', 'selectedSources']
    )
    or p_content ->> 'contractVersion' <> 'tailored-resume-version-content-v2'
    or p_content ->> 'providerInputContractVersion' <> 'tailoring-provider-input-v2'
    or p_content ->> 'providerOutputContractVersion' <> 'tailoring-plan-output-v2'
    or p_content ->> 'sourceFingerprint' !~ '^[0-9a-f]{64}$'
    or not public.is_valid_tailoring_plan_output_v2(p_content -> 'plan')
  then return false; end if;

  v_job := p_content -> 'job';
  if pg_catalog.jsonb_typeof(v_job) <> 'object'
    or (not public.jsonb_object_has_exact_keys(v_job, array['title', 'companyName']) and not public.jsonb_object_has_exact_keys(v_job, array['title', 'companyName', 'location']))
    or not public.is_normalized_bounded_string(v_job -> 'title', 1, 200)
    or not public.is_normalized_bounded_string(v_job -> 'companyName', 1, 160)
    or (v_job ? 'location' and not public.is_normalized_bounded_string(v_job -> 'location', 1, 160))
  then return false; end if;

  v_document := p_content -> 'document';
  if not public.jsonb_object_has_exact_keys(v_document, array['contractVersion', 'providerInputContractVersion', 'providerPlanContractVersion', 'sourceFingerprint', 'identity', 'education', 'sections'])
    or v_document ->> 'contractVersion' <> 'tailored-resume-document-v1'
    or v_document ->> 'providerInputContractVersion' <> 'tailoring-provider-input-v2'
    or v_document ->> 'providerPlanContractVersion' <> 'tailoring-plan-output-v2'
    or v_document ->> 'sourceFingerprint' <> p_content ->> 'sourceFingerprint'
    or pg_catalog.jsonb_typeof(v_document -> 'sections') <> 'array'
    or pg_catalog.jsonb_array_length(v_document -> 'sections') not between 1 and 8
    or pg_catalog.jsonb_array_length(v_document -> 'sections') <> pg_catalog.jsonb_array_length(p_content -> 'plan' -> 'sections')
  then return false; end if;

  v_identity := v_document -> 'identity';
  if not public.jsonb_object_has_exact_keys(v_identity, array['fullName', 'email'])
    or not public.is_normalized_bounded_string(v_identity -> 'fullName', 0, 160)
    or not public.is_normalized_bounded_string(v_identity -> 'email', 0, 320)
  then return false; end if;
  v_education := v_document -> 'education';
  if not public.jsonb_object_has_exact_keys(v_education, array['school', 'program', 'gradYear', 'coopTerm'])
    or not public.is_normalized_bounded_string(v_education -> 'school', 0, 120)
    or not public.is_normalized_bounded_string(v_education -> 'program', 0, 120)
    or not public.is_normalized_bounded_string(v_education -> 'gradYear', 0, 4)
    or not public.is_normalized_bounded_string(v_education -> 'coopTerm', 0, 80)
  then return false; end if;

  for v_section in select value from pg_catalog.jsonb_array_elements(v_document -> 'sections') loop
    v_plan_section := p_content -> 'plan' -> 'sections' -> v_index;
    v_index := v_index + 1;
    if not public.jsonb_object_has_exact_keys(v_section, array['type', 'entries', 'evidence'])
      or pg_catalog.jsonb_typeof(v_section -> 'type') <> 'string'
      or v_section ->> 'type' <> v_plan_section ->> 'type'
      or pg_catalog.jsonb_typeof(v_section -> 'entries') <> 'array'
      or pg_catalog.jsonb_typeof(v_section -> 'evidence') <> 'array'
      or pg_catalog.jsonb_array_length(v_section -> 'entries') > 20
      or pg_catalog.jsonb_array_length(v_section -> 'evidence') > 100
    then return false; end if;
    v_section_type := v_section ->> 'type';

    for v_entry in select value from pg_catalog.jsonb_array_elements(v_plan_section -> 'entries') loop
      for v_source in select value from pg_catalog.jsonb_array_elements(v_entry -> 'fragmentIds') loop
        v_plan_fragment_refs := v_plan_fragment_refs || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('entryId', v_entry ->> 'entryId', 'fragmentId', v_source #>> '{}'));
      end loop;
    end loop;
    for v_source in select value from pg_catalog.jsonb_array_elements(v_plan_section -> 'evidenceIds') loop
      v_plan_evidence_refs := v_plan_evidence_refs || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('evidenceId', v_source #>> '{}'));
    end loop;

    for v_entry in select value from pg_catalog.jsonb_array_elements(v_section -> 'entries') loop
      if not public.jsonb_object_has_exact_keys(v_entry, array['heading', 'bullets'])
        or not public.is_normalized_bounded_string(v_entry -> 'heading', 1, 160)
        or pg_catalog.jsonb_typeof(v_entry -> 'bullets') <> 'array'
        or pg_catalog.jsonb_array_length(v_entry -> 'bullets') not between 1 and 20
      then return false; end if;
      for v_bullet in select value from pg_catalog.jsonb_array_elements(v_entry -> 'bullets') loop
        if not public.jsonb_object_has_exact_keys(v_bullet, array['text', 'provenance'])
          or not public.is_normalized_bounded_string(v_bullet -> 'text', 1, 500)
          or not public.jsonb_object_has_exact_keys(v_bullet -> 'provenance', array['entryId', 'fragmentId'])
          or (v_bullet -> 'provenance' ->> 'entryId') !~ '^entry_[0-9]{3}$'
          or (v_bullet -> 'provenance' ->> 'fragmentId') !~ '^fragment_[0-9]{3}_[0-9]{3}$'
        then return false; end if;
        v_document_fragment_refs := v_document_fragment_refs || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('entryId', v_bullet -> 'provenance' ->> 'entryId', 'fragmentId', v_bullet -> 'provenance' ->> 'fragmentId'));
        v_document_fragments := v_document_fragments || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'entryId', v_bullet -> 'provenance' ->> 'entryId',
          'fragmentId', v_bullet -> 'provenance' ->> 'fragmentId',
          'heading', v_entry ->> 'heading',
          'text', v_bullet ->> 'text',
          'provenance', 'manual'
        ));
      end loop;
    end loop;

    for v_evidence in select value from pg_catalog.jsonb_array_elements(v_section -> 'evidence') loop
      if pg_catalog.jsonb_typeof(v_evidence) <> 'object'
        or (not public.jsonb_object_has_exact_keys(v_evidence, array['category', 'term', 'provenance']) and not public.jsonb_object_has_exact_keys(v_evidence, array['category', 'term', 'languageProficiency', 'provenance']))
        or pg_catalog.jsonb_typeof(v_evidence -> 'category') <> 'string'
        or not public.is_normalized_bounded_string(v_evidence -> 'term', 1, 160)
        or not public.jsonb_object_has_exact_keys(v_evidence -> 'provenance', array['evidenceId'])
        or (v_evidence -> 'provenance' ->> 'evidenceId') !~ '^(skill|technology|certification|language)_[0-9]{3}$'
      then return false; end if;
      v_category := v_evidence ->> 'category';
      if v_category not in ('skill', 'technology', 'certification', 'language')
        or (v_category = 'skill' and v_section_type <> 'skills')
        or (v_category = 'technology' and v_section_type <> 'technologies')
        or (v_category = 'certification' and v_section_type <> 'certifications')
        or (v_category = 'language' and v_section_type <> 'languages')
        or (v_evidence ? 'languageProficiency' and (v_category <> 'language' or v_evidence ->> 'languageProficiency' not in ('basic', 'conversational', 'professional', 'fluent', 'native')))
      then return false; end if;
      v_document_evidence_refs := v_document_evidence_refs || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('evidenceId', v_evidence -> 'provenance' ->> 'evidenceId'));
      v_document_evidence := v_document_evidence || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
          'evidenceId', v_evidence -> 'provenance' ->> 'evidenceId',
          'category', v_category,
          'term', v_evidence ->> 'term',
          'languageProficiency', v_evidence ->> 'languageProficiency'
        ))
      );
    end loop;
  end loop;

  v_selected := p_content -> 'selectedSources';
  if not public.jsonb_object_has_exact_keys(v_selected, array['fragments', 'evidence'])
    or pg_catalog.jsonb_typeof(v_selected -> 'fragments') <> 'array'
    or pg_catalog.jsonb_typeof(v_selected -> 'evidence') <> 'array'
    or pg_catalog.jsonb_array_length(v_selected -> 'fragments') > 2000
    or pg_catalog.jsonb_array_length(v_selected -> 'evidence') > 300
    or v_plan_fragment_refs <> v_document_fragment_refs
    or v_plan_evidence_refs <> v_document_evidence_refs
    or v_selected -> 'fragments' <> v_document_fragments
    or v_selected -> 'evidence' <> v_document_evidence
  then return false; end if;
  return true;
exception when others then return false;
end;
$$;

revoke all on function public.jsonb_object_has_exact_keys(jsonb, text[]) from public;
revoke all on function public.jsonb_object_has_exact_keys(jsonb, text[]) from anon;
revoke all on function public.jsonb_object_has_exact_keys(jsonb, text[]) from authenticated;
revoke all on function public.jsonb_object_has_exact_keys(jsonb, text[]) from service_role;
revoke all on function public.is_normalized_bounded_string(jsonb, integer, integer) from public;
revoke all on function public.is_normalized_bounded_string(jsonb, integer, integer) from anon;
revoke all on function public.is_normalized_bounded_string(jsonb, integer, integer) from authenticated;
revoke all on function public.is_normalized_bounded_string(jsonb, integer, integer) from service_role;
revoke all on function public.is_valid_tailoring_plan_output_v2(jsonb) from public;
revoke all on function public.is_valid_tailoring_plan_output_v2(jsonb) from anon;
revoke all on function public.is_valid_tailoring_plan_output_v2(jsonb) from authenticated;
revoke all on function public.is_valid_tailoring_plan_output_v2(jsonb) from service_role;
revoke all on function public.is_valid_tailored_resume_version_content_v2(jsonb) from public;
revoke all on function public.is_valid_tailored_resume_version_content_v2(jsonb) from anon;
revoke all on function public.is_valid_tailored_resume_version_content_v2(jsonb) from authenticated;
revoke all on function public.is_valid_tailored_resume_version_content_v2(jsonb) from service_role;

create function public.finalize_tailored_resume_document(
  p_reservation_id uuid,
  p_input_fingerprint text,
  p_provider_input_contract_version text,
  p_provider_output_contract_version text,
  p_version_content jsonb
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
    or p_provider_input_contract_version <> 'tailoring-provider-input-v2'
    or p_provider_output_contract_version <> 'tailoring-plan-output-v2'
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
      if v_version_name is null then
        return query select 'invalid_input'::text, v_reservation.id, null::uuid, null::text;
      else
        return query select 'already_completed'::text, v_reservation.id, v_reservation.resume_version_id, v_version_name;
      end if;
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

  if not public.is_valid_tailored_resume_version_content_v2(p_version_content)
    or p_version_content ->> 'sourceFingerprint' <> v_reservation.input_fingerprint
    or p_version_content ->> 'providerInputContractVersion' <> v_reservation.provider_input_contract_version
    or p_version_content ->> 'providerOutputContractVersion' <> v_reservation.provider_output_contract_version
  then
    return query select 'invalid_output'::text, v_reservation.id, null::uuid, null::text;
    return;
  end if;

  select coalesce(nullif(pg_catalog.btrim(pg_catalog.regexp_replace(job.title, '\s+', ' ', 'g')), ''), 'Private job')
  into v_job_title
  from public.job_postings as job
  where job.id = v_reservation.job_posting_id and job.user_id = v_user_id
  for key share;
  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text;
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
    v_user_id, v_reservation.job_posting_id, v_version_name, null, null,
    p_version_content, '{}'::jsonb, null
  ) returning id into v_resume_version_id;

  insert into public.tailoring_credit_ledger (user_id, amount, reason, ref, metadata)
  values (
    v_user_id, -1, 'tailor_generation',
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

revoke all on function public.finalize_tailored_resume_document(uuid, text, text, text, jsonb) from public;
revoke all on function public.finalize_tailored_resume_document(uuid, text, text, text, jsonb) from anon;
revoke all on function public.finalize_tailored_resume_document(uuid, text, text, text, jsonb) from authenticated;
revoke all on function public.finalize_tailored_resume_document(uuid, text, text, text, jsonb) from service_role;

revoke all on function public.finalize_tailoring_generated_content_trusted(uuid, uuid, text, text, text, jsonb) from public;
revoke all on function public.finalize_tailoring_generated_content_trusted(uuid, uuid, text, text, text, jsonb) from anon;
revoke all on function public.finalize_tailoring_generated_content_trusted(uuid, uuid, text, text, text, jsonb) from authenticated;
revoke all on function public.finalize_tailoring_generated_content_trusted(uuid, uuid, text, text, text, jsonb) from service_role;
drop function public.finalize_tailoring_generated_content_trusted(uuid, uuid, text, text, text, jsonb);

create function public.finalize_tailored_resume_document_trusted(
  p_user_id uuid,
  p_reservation_id uuid,
  p_input_fingerprint text,
  p_provider_input_contract_version text,
  p_provider_output_contract_version text,
  p_version_content jsonb
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
begin
  if p_user_id is null then
    return query select 'invalid_input'::text, null::uuid, null::uuid, null::text;
    return;
  end if;
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
  return query
  select *
  from public.finalize_tailored_resume_document(
    p_reservation_id,
    p_input_fingerprint,
    p_provider_input_contract_version,
    p_provider_output_contract_version,
    p_version_content
  );
end;
$$;

revoke all on function public.finalize_tailored_resume_document_trusted(uuid, uuid, text, text, text, jsonb) from public;
revoke all on function public.finalize_tailored_resume_document_trusted(uuid, uuid, text, text, text, jsonb) from anon;
revoke all on function public.finalize_tailored_resume_document_trusted(uuid, uuid, text, text, text, jsonb) from authenticated;
grant execute on function public.finalize_tailored_resume_document_trusted(uuid, uuid, text, text, text, jsonb) to service_role;
