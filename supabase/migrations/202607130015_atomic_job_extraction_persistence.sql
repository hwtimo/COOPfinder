-- Atomically persist one validated extraction for a caller-owned pasted-text job.

create or replace function public.persist_job_extraction(
  p_job_posting_id uuid,
  p_extracted jsonb,
  p_overall_confidence numeric
) returns table (
  result_status text,
  job_posting_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_intake_source text;
  v_raw_text text;
  v_existing_extracted jsonb;
  v_existing_confidence numeric(3,2);
  v_stored_confidence numeric(3,2);
  v_json_confidence numeric;
  v_field text;
  v_field_json jsonb;
  v_field_confidence numeric;
  v_value_type text;
  v_value_text text;
  v_max_length integer;
  v_max_items integer;
  v_item jsonb;
  v_item_text text;
  v_normalized_item text;
  v_seen_items text[];
  v_deadline date;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication required';
  end if;

  if p_job_posting_id is null
    or p_extracted is null
    or pg_catalog.jsonb_typeof(p_extracted) is distinct from 'object'
    or pg_catalog.octet_length(p_extracted::text) > 1000000
    or p_overall_confidence is null
    or p_overall_confidence::text in ('NaN', 'Infinity', '-Infinity')
    or p_overall_confidence < 0
    or p_overall_confidence > 1
  then
    return query select 'invalid_input'::text, null::uuid;
    return;
  end if;

  if not (
    p_extracted ?& array[
      'contractVersion',
      'companyName',
      'title',
      'location',
      'workMode',
      'term',
      'deadline',
      'namedSkills',
      'responsibilities',
      'requirements',
      'overallConfidence'
    ]::text[]
  ) or exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_extracted) as top_level(key)
    where top_level.key <> all (array[
      'contractVersion',
      'companyName',
      'title',
      'location',
      'workMode',
      'term',
      'deadline',
      'namedSkills',
      'responsibilities',
      'requirements',
      'overallConfidence'
    ]::text[])
  ) then
    return query select 'invalid_input'::text, null::uuid;
    return;
  end if;

  if pg_catalog.jsonb_typeof(p_extracted->'contractVersion') is distinct from 'string'
    or p_extracted->>'contractVersion' <> 'job-extraction-v1'
    or pg_catalog.jsonb_typeof(p_extracted->'overallConfidence') is distinct from 'number'
  then
    return query select 'invalid_input'::text, null::uuid;
    return;
  end if;

  v_json_confidence := (p_extracted->>'overallConfidence')::numeric;
  if v_json_confidence < 0
    or v_json_confidence > 1
    or v_json_confidence <> p_overall_confidence
  then
    return query select 'invalid_input'::text, null::uuid;
    return;
  end if;

  foreach v_field in array array[
    'companyName',
    'title',
    'location',
    'workMode',
    'term',
    'deadline',
    'namedSkills',
    'responsibilities',
    'requirements'
  ]::text[] loop
    v_field_json := p_extracted->v_field;

    if pg_catalog.jsonb_typeof(v_field_json) is distinct from 'object'
      or not (v_field_json ?& array['value', 'confidence']::text[])
      or exists (
        select 1
        from pg_catalog.jsonb_object_keys(v_field_json) as nested(key)
        where nested.key <> all (array['value', 'confidence']::text[])
      )
      or pg_catalog.jsonb_typeof(v_field_json->'confidence') is distinct from 'number'
    then
      return query select 'invalid_input'::text, null::uuid;
      return;
    end if;

    v_field_confidence := (v_field_json->>'confidence')::numeric;
    if v_field_confidence < 0 or v_field_confidence > 1 then
      return query select 'invalid_input'::text, null::uuid;
      return;
    end if;
  end loop;

  foreach v_field in array array[
    'companyName',
    'title',
    'location',
    'workMode',
    'term',
    'deadline'
  ]::text[] loop
    v_field_json := p_extracted->v_field;
    v_value_type := pg_catalog.jsonb_typeof(v_field_json->'value');

    if v_value_type not in ('string', 'null') then
      return query select 'invalid_input'::text, null::uuid;
      return;
    end if;

    if v_value_type = 'string' then
      v_value_text := v_field_json->>'value';
      v_max_length := case v_field
        when 'companyName' then 160
        when 'title' then 200
        when 'location' then 160
        when 'workMode' then 20
        when 'term' then 120
        when 'deadline' then 10
      end;

      if pg_catalog.btrim(v_value_text) = ''
        or v_value_text <> pg_catalog.btrim(v_value_text)
        or pg_catalog.char_length(v_value_text) > v_max_length
      then
        return query select 'invalid_input'::text, null::uuid;
        return;
      end if;

      if v_field = 'workMode'
        and v_value_text not in ('Remote', 'Hybrid', 'On-site')
      then
        return query select 'invalid_input'::text, null::uuid;
        return;
      end if;

      if v_field = 'deadline' then
        if v_value_text !~ '^\d{4}-\d{2}-\d{2}$' then
          return query select 'invalid_input'::text, null::uuid;
          return;
        end if;

        begin
          v_deadline := v_value_text::date;
        exception when others then
          return query select 'invalid_input'::text, null::uuid;
          return;
        end;

        if pg_catalog.to_char(v_deadline, 'YYYY-MM-DD') <> v_value_text then
          return query select 'invalid_input'::text, null::uuid;
          return;
        end if;
      end if;
    end if;
  end loop;

  foreach v_field in array array[
    'namedSkills',
    'responsibilities',
    'requirements'
  ]::text[] loop
    v_field_json := p_extracted->v_field;
    v_value_type := pg_catalog.jsonb_typeof(v_field_json->'value');

    if v_value_type not in ('array', 'null') then
      return query select 'invalid_input'::text, null::uuid;
      return;
    end if;

    if v_value_type = 'array' then
      v_max_items := case v_field
        when 'namedSkills' then 60
        when 'responsibilities' then 50
        when 'requirements' then 80
      end;
      v_max_length := case v_field
        when 'namedSkills' then 80
        when 'responsibilities' then 1000
        when 'requirements' then 1000
      end;

      if pg_catalog.jsonb_array_length(v_field_json->'value') > v_max_items then
        return query select 'invalid_input'::text, null::uuid;
        return;
      end if;

      v_seen_items := array[]::text[];
      for v_item in
        select item.value
        from pg_catalog.jsonb_array_elements(v_field_json->'value') as item(value)
      loop
        if pg_catalog.jsonb_typeof(v_item) is distinct from 'string' then
          return query select 'invalid_input'::text, null::uuid;
          return;
        end if;

        v_item_text := v_item #>> '{}';
        if pg_catalog.btrim(v_item_text) = ''
          or v_item_text <> pg_catalog.btrim(v_item_text)
          or pg_catalog.char_length(v_item_text) > v_max_length
        then
          return query select 'invalid_input'::text, null::uuid;
          return;
        end if;

        v_normalized_item := pg_catalog.lower(
          pg_catalog.regexp_replace(v_item_text, '[[:space:]]+', ' ', 'g')
        );
        if v_normalized_item = any(v_seen_items) then
          return query select 'invalid_input'::text, null::uuid;
          return;
        end if;
        v_seen_items := pg_catalog.array_append(v_seen_items, v_normalized_item);
      end loop;
    end if;
  end loop;

  v_stored_confidence := pg_catalog.round(p_overall_confidence, 2);

  select
    job.intake_source,
    job.raw_text,
    job.extracted,
    job.extraction_confidence
  into
    v_intake_source,
    v_raw_text,
    v_existing_extracted,
    v_existing_confidence
  from public.job_postings as job
  where job.id = p_job_posting_id
    and job.user_id = v_user_id
  for update;

  if not found then
    return query select 'unavailable'::text, null::uuid;
    return;
  end if;

  if v_intake_source <> 'pasted_text' then
    return query select 'unsupported_source'::text, p_job_posting_id;
    return;
  end if;

  if v_raw_text is null or pg_catalog.btrim(v_raw_text) = '' then
    return query select 'invalid_input'::text, p_job_posting_id;
    return;
  end if;

  if v_existing_extracted = p_extracted
    and v_existing_confidence is not distinct from v_stored_confidence
  then
    return query select 'unchanged'::text, p_job_posting_id;
    return;
  end if;

  update public.job_postings as job
  set
    extracted = p_extracted,
    extraction_confidence = v_stored_confidence
  where job.id = p_job_posting_id
    and job.user_id = v_user_id;

  insert into public.job_intake_events (
    user_id,
    input_type,
    url,
    outcome,
    overall_confidence,
    model_tier,
    job_posting_id
  ) values (
    v_user_id,
    'text',
    null,
    'extracted',
    v_stored_confidence,
    'luna',
    p_job_posting_id
  );

  return query select 'updated'::text, p_job_posting_id;
end;
$$;

comment on function public.persist_job_extraction(uuid, jsonb, numeric) is
  'Atomically stores one validated job-extraction-v1 result for a caller-owned pasted-text job and records one minimal success event.';

revoke all on function public.persist_job_extraction(uuid, jsonb, numeric) from public;
revoke all on function public.persist_job_extraction(uuid, jsonb, numeric) from anon;
grant execute on function public.persist_job_extraction(uuid, jsonb, numeric) to authenticated;
