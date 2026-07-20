create function public.is_valid_tailoring_generated_content_v1(
  p_content jsonb
) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_job jsonb;
  v_plan jsonb;
  v_section jsonb;
  v_item jsonb;
  v_evidence jsonb;
  v_id text;
  v_category text;
  v_source_type text;
  v_section_type text;
  v_plan_ids text[] := array[]::text[];
  v_selected_ids text[] := array[]::text[];
  v_selected_categories text[] := array[]::text[];
  v_position integer;
begin
  if p_content is null or pg_catalog.jsonb_typeof(p_content) <> 'object' then return false; end if;
  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_content)) <> 7
    or exists (
      select 1 from pg_catalog.jsonb_object_keys(p_content) as keys(key_name)
      where key_name not in (
        'contractVersion', 'providerInputContractVersion',
        'providerOutputContractVersion', 'inputFingerprint', 'job', 'plan',
        'selectedEvidence'
      )
    )
    or p_content ->> 'contractVersion' <> 'tailoring-generated-content-v1'
    or p_content ->> 'providerInputContractVersion' <> 'tailoring-provider-input-v1'
    or p_content ->> 'providerOutputContractVersion' <> 'tailoring-plan-output-v1'
    or p_content ->> 'inputFingerprint' !~ '^[0-9a-f]{64}$'
    or pg_catalog.jsonb_typeof(p_content -> 'job') <> 'object'
    or pg_catalog.jsonb_typeof(p_content -> 'plan') <> 'object'
    or pg_catalog.jsonb_typeof(p_content -> 'selectedEvidence') <> 'array'
    or pg_catalog.jsonb_array_length(p_content -> 'selectedEvidence') > 300
  then return false; end if;

  v_job := p_content -> 'job';
  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_job)) not in (2, 3)
    or exists (
      select 1 from pg_catalog.jsonb_object_keys(v_job) as keys(key_name)
      where key_name not in ('title', 'companyName', 'location')
    )
    or pg_catalog.jsonb_typeof(v_job -> 'title') <> 'string'
    or pg_catalog.jsonb_typeof(v_job -> 'companyName') <> 'string'
    or pg_catalog.length(v_job ->> 'title') not between 1 and 200
    or pg_catalog.length(v_job ->> 'companyName') not between 1 and 160
    or pg_catalog.btrim(pg_catalog.regexp_replace(v_job ->> 'title', '\s+', ' ', 'g')) <> v_job ->> 'title'
    or pg_catalog.btrim(pg_catalog.regexp_replace(v_job ->> 'companyName', '\s+', ' ', 'g')) <> v_job ->> 'companyName'
    or (
      v_job ? 'location'
      and (
        pg_catalog.jsonb_typeof(v_job -> 'location') <> 'string'
        or pg_catalog.length(v_job ->> 'location') not between 1 and 160
        or pg_catalog.btrim(pg_catalog.regexp_replace(v_job ->> 'location', '\s+', ' ', 'g')) <> v_job ->> 'location'
      )
    )
  then return false; end if;

  v_plan := p_content -> 'plan';
  if not public.is_valid_tailoring_plan_output_v1(v_plan) then return false; end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(v_plan -> 'summaryEvidenceIds') loop
    v_plan_ids := pg_catalog.array_append(v_plan_ids, v_item #>> '{}');
  end loop;
  for v_section in select value from pg_catalog.jsonb_array_elements(v_plan -> 'sections') loop
    for v_item in select value from pg_catalog.jsonb_array_elements(v_section -> 'items') loop
      v_plan_ids := pg_catalog.array_append(v_plan_ids, v_item ->> 'evidenceId');
    end loop;
  end loop;

  for v_evidence in select value from pg_catalog.jsonb_array_elements(p_content -> 'selectedEvidence') loop
    if pg_catalog.jsonb_typeof(v_evidence) <> 'object'
      or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_evidence)) not between 4 and 6
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_evidence) as keys(key_name)
        where key_name not in (
          'evidenceId', 'category', 'term', 'sourceType', 'sourceLabel',
          'languageProficiency'
        )
      )
      or not (v_evidence ?& array['evidenceId', 'category', 'term', 'sourceType'])
      or pg_catalog.jsonb_typeof(v_evidence -> 'evidenceId') <> 'string'
      or pg_catalog.jsonb_typeof(v_evidence -> 'category') <> 'string'
      or pg_catalog.jsonb_typeof(v_evidence -> 'term') <> 'string'
      or pg_catalog.jsonb_typeof(v_evidence -> 'sourceType') <> 'string'
    then return false; end if;

    v_id := v_evidence ->> 'evidenceId';
    v_category := v_evidence ->> 'category';
    v_source_type := v_evidence ->> 'sourceType';
    if v_id !~ '^ev_[0-9]{3}$' or v_id = any(v_selected_ids)
      or v_category not in ('general_skill', 'technology', 'soft_skill', 'certification', 'language', 'keyword')
      or v_source_type not in (
        'top_level_general_skill', 'confirmed_entry_skill', 'explicit_technology',
        'legacy_technology_fallback', 'explicit_soft_skill', 'explicit_certification',
        'confirmed_certification_title', 'explicit_language'
      )
      or pg_catalog.length(v_evidence ->> 'term') not between 1 and 160
      or pg_catalog.btrim(pg_catalog.regexp_replace(v_evidence ->> 'term', '\s+', ' ', 'g')) <> v_evidence ->> 'term'
      or (v_source_type in ('top_level_general_skill', 'confirmed_entry_skill') and v_category not in ('general_skill', 'keyword'))
      or (v_source_type in ('explicit_technology', 'legacy_technology_fallback') and v_category <> 'technology')
      or (v_source_type = 'explicit_soft_skill' and v_category <> 'soft_skill')
      or (v_source_type in ('explicit_certification', 'confirmed_certification_title') and v_category <> 'certification')
      or (v_source_type = 'explicit_language' and v_category <> 'language')
      or (
        v_evidence ? 'sourceLabel'
        and (
          pg_catalog.jsonb_typeof(v_evidence -> 'sourceLabel') <> 'string'
          or pg_catalog.length(v_evidence ->> 'sourceLabel') not between 1 and 160
          or pg_catalog.btrim(pg_catalog.regexp_replace(v_evidence ->> 'sourceLabel', '\s+', ' ', 'g')) <> v_evidence ->> 'sourceLabel'
        )
      )
      or (
        v_evidence ? 'languageProficiency'
        and (
          v_category <> 'language'
          or pg_catalog.jsonb_typeof(v_evidence -> 'languageProficiency') <> 'string'
          or v_evidence ->> 'languageProficiency' not in ('basic', 'conversational', 'professional', 'fluent', 'native')
        )
      )
    then return false; end if;
    v_selected_ids := pg_catalog.array_append(v_selected_ids, v_id);
    v_selected_categories := pg_catalog.array_append(v_selected_categories, v_category);
  end loop;

  if v_plan_ids <> v_selected_ids then return false; end if;

  for v_section in select value from pg_catalog.jsonb_array_elements(v_plan -> 'sections') loop
    v_section_type := v_section ->> 'type';
    for v_item in select value from pg_catalog.jsonb_array_elements(v_section -> 'items') loop
      v_position := pg_catalog.array_position(v_selected_ids, v_item ->> 'evidenceId');
      if v_position is null
        or (v_selected_categories[v_position] = 'general_skill' and v_section_type not in ('general_skills', 'supporting_evidence'))
        or (v_selected_categories[v_position] = 'technology' and v_section_type not in ('technologies', 'supporting_evidence'))
        or (v_selected_categories[v_position] = 'soft_skill' and v_section_type not in ('soft_skills', 'supporting_evidence'))
        or (v_selected_categories[v_position] = 'certification' and v_section_type not in ('certifications', 'supporting_evidence'))
        or (v_selected_categories[v_position] = 'language' and v_section_type not in ('languages', 'supporting_evidence'))
        or (v_selected_categories[v_position] = 'keyword' and v_section_type <> 'supporting_evidence')
      then return false; end if;
    end loop;
  end loop;

  return true;
exception when others then return false;
end;
$$;

revoke all on function public.is_valid_tailoring_generated_content_v1(jsonb) from public;
revoke all on function public.is_valid_tailoring_generated_content_v1(jsonb) from anon;
revoke all on function public.is_valid_tailoring_generated_content_v1(jsonb) from authenticated;
revoke all on function public.is_valid_tailoring_generated_content_v1(jsonb) from service_role;

create function public.finalize_tailoring_generated_content(
  p_reservation_id uuid,
  p_input_fingerprint text,
  p_provider_input_contract_version text,
  p_provider_output_contract_version text,
  p_generated_content jsonb
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
    or p_generated_content is null
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
    or p_generated_content ->> 'inputFingerprint' <> v_reservation.input_fingerprint
    or p_generated_content ->> 'providerInputContractVersion' <> v_reservation.provider_input_contract_version
    or p_generated_content ->> 'providerOutputContractVersion' <> v_reservation.provider_output_contract_version
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

  if not public.is_valid_tailoring_generated_content_v1(p_generated_content) then
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
    v_user_id, v_reservation.job_posting_id, v_version_name, null, null,
    p_generated_content, '{}'::jsonb, null
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

revoke all on function public.finalize_tailoring_generated_content(uuid, text, text, text, jsonb) from public;
revoke all on function public.finalize_tailoring_generated_content(uuid, text, text, text, jsonb) from anon;
revoke all on function public.finalize_tailoring_generated_content(uuid, text, text, text, jsonb) from authenticated;
revoke all on function public.finalize_tailoring_generated_content(uuid, text, text, text, jsonb) from service_role;

revoke all on function public.finalize_tailoring_generation_trusted(uuid, uuid, text, text, text, jsonb) from service_role;
drop function public.finalize_tailoring_generation_trusted(uuid, uuid, text, text, text, jsonb);

create function public.finalize_tailoring_generated_content_trusted(
  p_user_id uuid,
  p_reservation_id uuid,
  p_input_fingerprint text,
  p_provider_input_contract_version text,
  p_provider_output_contract_version text,
  p_generated_content jsonb
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
  from public.finalize_tailoring_generated_content(
    p_reservation_id,
    p_input_fingerprint,
    p_provider_input_contract_version,
    p_provider_output_contract_version,
    p_generated_content
  );
end;
$$;

revoke all on function public.finalize_tailoring_generated_content_trusted(uuid, uuid, text, text, text, jsonb) from public;
revoke all on function public.finalize_tailoring_generated_content_trusted(uuid, uuid, text, text, text, jsonb) from anon;
revoke all on function public.finalize_tailoring_generated_content_trusted(uuid, uuid, text, text, text, jsonb) from authenticated;
grant execute on function public.finalize_tailoring_generated_content_trusted(uuid, uuid, text, text, text, jsonb) to service_role;
