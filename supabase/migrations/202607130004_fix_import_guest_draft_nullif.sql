-- Correct invalid schema qualification of the NULLIF SQL expression.

CREATE OR REPLACE FUNCTION public.import_guest_draft(p_draft jsonb, p_mode text DEFAULT 'auto'::text)
 RETURNS TABLE(result_status text, draft_hash text, imported_profile_fields integer, imported_skills integer, imported_entries integer, imported_jobs integer, skipped_entries integer, skipped_jobs integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_hash text;
  v_profile jsonb;
  v_entry jsonb;
  v_job jsonb;
  v_skill jsonb;
  v_master_profile_id uuid;
  v_profile_row public.profiles%rowtype;
  v_has_existing boolean;
  v_incoming_targets text[] := '{}';
  v_incoming_locations text[] := '{}';
  v_incoming_skills text[] := '{}';
  v_existing_skills text[] := '{}';
  v_merged text[] := '{}';
  v_entry_skills text[];
  v_title text;
  v_text text;
  v_url text;
  v_raw_text text;
  v_profile_count integer := 0;
  v_skill_count integer := 0;
  v_entry_count integer := 0;
  v_job_count integer := 0;
  v_skipped_entry_count integer := 0;
  v_skipped_job_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_mode not in ('auto', 'merge') then
    raise exception 'invalid import mode';
  end if;
  if p_draft is null or pg_catalog.jsonb_typeof(p_draft) <> 'object'
    or p_draft->>'version' <> '1'
    or pg_catalog.jsonb_typeof(p_draft->'profile') <> 'object'
    or pg_catalog.jsonb_typeof(p_draft->'skills') <> 'array'
    or pg_catalog.jsonb_typeof(p_draft->'entries') <> 'array'
    or pg_catalog.jsonb_typeof(p_draft->'stashedJobs') <> 'array' then
    raise exception 'invalid guest draft';
  end if;
  if pg_catalog.jsonb_array_length(p_draft->'skills') > 60
    or pg_catalog.jsonb_array_length(p_draft->'entries') > 40
    or pg_catalog.jsonb_array_length(p_draft->'stashedJobs') > 20 then
    raise exception 'guest draft exceeds import limits';
  end if;

  v_profile := p_draft->'profile';
  if pg_catalog.length(pg_catalog.btrim(v_profile->>'program')) > 120
    or pg_catalog.length(pg_catalog.btrim(v_profile->>'coopTerm')) > 80
    or (v_profile ? 'school' and v_profile->>'school' not in ('SFU','UBC','Waterloo','Other'))
    or (
      v_profile ? 'workAuthorization'
      and v_profile->>'workAuthorization' not in (
        'Canadian work authorization','Domestic students','International eligible'
      )
    ) then
    raise exception 'invalid guest profile';
  end if;
  if coalesce(pg_catalog.jsonb_typeof(v_profile->'targetRoles'), 'array') <> 'array'
    or coalesce(pg_catalog.jsonb_typeof(v_profile->'preferredLocations'), 'array') <> 'array'
    or pg_catalog.jsonb_array_length(coalesce(v_profile->'targetRoles', '[]'::jsonb)) > 12
    or pg_catalog.jsonb_array_length(coalesce(v_profile->'preferredLocations', '[]'::jsonb)) > 12 then
    raise exception 'invalid guest profile arrays';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      coalesce(v_profile->'targetRoles', '[]'::jsonb)
    ) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
      or pg_catalog.length(pg_catalog.btrim(item.value #>> '{}')) > 80
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      coalesce(v_profile->'preferredLocations', '[]'::jsonb)
    ) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
      or pg_catalog.length(pg_catalog.btrim(item.value #>> '{}')) > 80
  ) then
    raise exception 'invalid guest profile array item';
  end if;

  select coalesce(pg_catalog.array_agg(pg_catalog.btrim(value)), '{}')
  into v_incoming_targets
  from pg_catalog.jsonb_array_elements_text(
    coalesce(v_profile->'targetRoles', '[]'::jsonb)
  ) as item(value)
  where pg_catalog.btrim(value) <> '' and pg_catalog.length(pg_catalog.btrim(value)) <= 80;

  select coalesce(pg_catalog.array_agg(pg_catalog.btrim(value)), '{}')
  into v_incoming_locations
  from pg_catalog.jsonb_array_elements_text(
    coalesce(v_profile->'preferredLocations', '[]'::jsonb)
  ) as item(value)
  where pg_catalog.btrim(value) <> '' and pg_catalog.length(pg_catalog.btrim(value)) <= 80;

  for v_skill in select value from pg_catalog.jsonb_array_elements(p_draft->'skills')
  loop
    if pg_catalog.jsonb_typeof(v_skill) <> 'string'
      or pg_catalog.length(pg_catalog.btrim(v_skill #>> '{}')) > 80 then
      raise exception 'invalid guest skill';
    end if;
    if pg_catalog.btrim(v_skill #>> '{}') <> '' then
      v_incoming_skills := pg_catalog.array_append(
        v_incoming_skills,
        pg_catalog.btrim(v_skill #>> '{}')
      );
    end if;
  end loop;

  for v_entry in select value from pg_catalog.jsonb_array_elements(p_draft->'entries')
  loop
    if pg_catalog.jsonb_typeof(v_entry) <> 'object'
      or v_entry->>'section' not in ('education','experience','project','skills')
      or pg_catalog.length(pg_catalog.btrim(v_entry->>'title')) > 160
      or pg_catalog.length(pg_catalog.btrim(v_entry->>'text')) > 2000
      or (
        coalesce(pg_catalog.btrim(v_entry->>'title'), '') = ''
        and coalesce(pg_catalog.btrim(v_entry->>'text'), '') = ''
      )
      or pg_catalog.jsonb_typeof(v_entry->'skills') <> 'array'
      or pg_catalog.jsonb_array_length(v_entry->'skills') > 30 then
      raise exception 'invalid guest entry';
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_array_elements_text(v_entry->'skills') as item(value)
      where pg_catalog.length(pg_catalog.btrim(item.value)) > 80
    ) then
      raise exception 'invalid guest entry skill';
    end if;
  end loop;

  for v_job in select value from pg_catalog.jsonb_array_elements(p_draft->'stashedJobs')
  loop
    v_url := nullif(pg_catalog.btrim(v_job->>'url'), '');
    v_raw_text := nullif(pg_catalog.btrim(v_job->>'text'), '');
    if pg_catalog.jsonb_typeof(v_job) <> 'object'
      or v_job->>'inputType' not in ('url','text')
      or (v_job->>'inputType' = 'url' and v_url is null)
      or (v_job->>'inputType' = 'text' and v_raw_text is null)
      or pg_catalog.length(v_raw_text) > 12000
      or (
        v_url is not null
        and (
          pg_catalog.length(v_url) > 2048
          or v_url !~* '^https?://[^[:space:]]+$'
        )
      ) then
      raise exception 'invalid stashed job';
    end if;
  end loop;

  v_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_draft::text, 'UTF8'), 'sha256'),
    'hex'
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  if exists (
    select 1 from public.guest_draft_imports
    where user_id = v_user_id and draft_hash = v_hash
  ) then
    return query select 'already_imported', v_hash, 0, 0, 0, 0, 0, 0;
    return;
  end if;

  select (
    exists (
      select 1 from public.profiles p
      where p.user_id = v_user_id and (
        nullif(pg_catalog.btrim(p.full_name), '') is not null
        or p.school is not null
        or nullif(pg_catalog.btrim(p.program), '') is not null
        or p.grad_year is not null
        or nullif(pg_catalog.btrim(p.coop_term), '') is not null
        or p.work_authorization is not null
        or pg_catalog.cardinality(p.preferred_locations) > 0
        or pg_catalog.cardinality(p.target_roles) > 0
      )
    ) or exists (
      select 1 from public.master_profiles m
      where m.user_id = v_user_id and (
        nullif(pg_catalog.btrim(m.summary), '') is not null
        or m.data <> '{}'::jsonb
      )
    ) or exists (
      select 1 from public.master_profile_entries e where e.user_id = v_user_id
    ) or exists (
      select 1 from public.job_postings j where j.user_id = v_user_id
    )
  ) into v_has_existing;

  if p_mode = 'auto' and v_has_existing then
    return query select 'needs_confirmation', v_hash, 0, 0, 0, 0, 0, 0;
    return;
  end if;

  insert into public.profiles (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_profile_row
  from public.profiles
  where user_id = v_user_id
  for update;

  if nullif(pg_catalog.btrim(v_profile_row.school), '') is null
    and nullif(pg_catalog.btrim(v_profile->>'school'), '') is not null then
    v_profile_count := v_profile_count + 1;
  end if;
  if nullif(pg_catalog.btrim(v_profile_row.program), '') is null
    and nullif(pg_catalog.btrim(v_profile->>'program'), '') is not null then
    v_profile_count := v_profile_count + 1;
  end if;
  if nullif(pg_catalog.btrim(v_profile_row.coop_term), '') is null
    and nullif(pg_catalog.btrim(v_profile->>'coopTerm'), '') is not null then
    v_profile_count := v_profile_count + 1;
  end if;
  if nullif(pg_catalog.btrim(v_profile_row.work_authorization), '') is null
    and nullif(pg_catalog.btrim(v_profile->>'workAuthorization'), '') is not null then
    v_profile_count := v_profile_count + 1;
  end if;

  select coalesce(pg_catalog.array_agg(value order by ord), '{}')
  into v_merged
  from (
    select distinct on (pg_catalog.lower(value)) value, ord
    from pg_catalog.unnest(
      coalesce(v_profile_row.target_roles, '{}') || v_incoming_targets
    ) with ordinality as merged(value, ord)
    where pg_catalog.btrim(value) <> ''
    order by pg_catalog.lower(value), ord
  ) deduped;

  update public.profiles set
    school = case when nullif(pg_catalog.btrim(school), '') is null
      then nullif(v_profile->>'school', '') else school end,
    program = case when nullif(pg_catalog.btrim(program), '') is null
      then nullif(pg_catalog.btrim(v_profile->>'program'), '') else program end,
    coop_term = case when nullif(pg_catalog.btrim(coop_term), '') is null
      then nullif(pg_catalog.btrim(v_profile->>'coopTerm'), '') else coop_term end,
    work_authorization = case when nullif(pg_catalog.btrim(work_authorization), '') is null
      then nullif(v_profile->>'workAuthorization', '') else work_authorization end,
    target_roles = v_merged
  where user_id = v_user_id;

  select coalesce(pg_catalog.array_agg(value order by ord), '{}')
  into v_merged
  from (
    select distinct on (pg_catalog.lower(value)) value, ord
    from pg_catalog.unnest(
      coalesce(v_profile_row.preferred_locations, '{}') || v_incoming_locations
    ) with ordinality as merged(value, ord)
    where pg_catalog.btrim(value) <> ''
    order by pg_catalog.lower(value), ord
  ) deduped;

  update public.profiles set preferred_locations = v_merged
  where user_id = v_user_id;

  insert into public.master_profiles (user_id, data)
  values (v_user_id, '{}'::jsonb)
  on conflict (user_id) do update set user_id = excluded.user_id
  returning id into v_master_profile_id;

  select case
    when pg_catalog.jsonb_typeof(data->'skills') = 'array' then
      array(
        select value from pg_catalog.jsonb_array_elements_text(data->'skills') as item(value)
      )
    else '{}'::text[]
  end
  into v_existing_skills
  from public.master_profiles
  where id = v_master_profile_id;

  select coalesce(pg_catalog.array_agg(value order by ord), '{}')
  into v_merged
  from (
    select distinct on (pg_catalog.lower(value)) value, ord
    from pg_catalog.unnest(v_existing_skills || v_incoming_skills)
      with ordinality as merged(value, ord)
    where pg_catalog.btrim(value) <> ''
    order by pg_catalog.lower(value), ord
  ) deduped;

  select pg_catalog.count(*)::integer into v_skill_count
  from pg_catalog.unnest(v_merged) as skill(value)
  where not exists (
    select 1 from pg_catalog.unnest(v_existing_skills) as existing(value)
    where pg_catalog.lower(existing.value) = pg_catalog.lower(skill.value)
  );

  update public.master_profiles
  set data = pg_catalog.jsonb_set(data, '{skills}', pg_catalog.to_jsonb(v_merged), true)
  where id = v_master_profile_id;

  for v_entry in select value from pg_catalog.jsonb_array_elements(p_draft->'entries')
  loop
    v_title := coalesce(pg_catalog.btrim(v_entry->>'title'), '');
    v_text := coalesce(pg_catalog.btrim(v_entry->>'text'), '');
    if exists (
      select 1 from public.master_profile_entries e
      where e.user_id = v_user_id
        and e.section = v_entry->>'section'
        and pg_catalog.lower(coalesce(e.source_label, e.title, '')) = pg_catalog.lower(v_title)
        and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(e.entry_text), '[[:space:]]+', ' ', 'g'))
          = pg_catalog.lower(pg_catalog.regexp_replace(
              pg_catalog.btrim(coalesce(nullif(v_text, ''), v_title)),
              '[[:space:]]+', ' ', 'g'
            ))
    ) then
      v_skipped_entry_count := v_skipped_entry_count + 1;
      continue;
    end if;

    select coalesce(pg_catalog.array_agg(pg_catalog.btrim(value)), '{}')
    into v_entry_skills
    from pg_catalog.jsonb_array_elements_text(v_entry->'skills') as item(value)
    where pg_catalog.btrim(value) <> '';

    insert into public.master_profile_entries (
      user_id, master_profile_id, section, source_label, title,
      entry_text, skills, confirmed, sort_order
    ) values (
      v_user_id,
      v_master_profile_id,
      v_entry->>'section',
      nullif(v_title, ''),
      nullif(v_title, ''),
      coalesce(nullif(v_text, ''), v_title),
      v_entry_skills,
      true,
      coalesce((
        select pg_catalog.max(sort_order) + 1
        from public.master_profile_entries
        where user_id = v_user_id
      ), 0)
    );
    v_entry_count := v_entry_count + 1;
  end loop;

  for v_job in select value from pg_catalog.jsonb_array_elements(p_draft->'stashedJobs')
  loop
    v_url := nullif(pg_catalog.btrim(v_job->>'url'), '');
    v_raw_text := nullif(pg_catalog.btrim(v_job->>'text'), '');

    if exists (
      select 1 from public.job_postings j
      where j.user_id = v_user_id and (
        (v_url is not null and j.source_url = v_url)
        or (
          v_raw_text is not null and j.raw_text is not null
          and pg_catalog.regexp_replace(pg_catalog.btrim(j.raw_text), '[[:space:]]+', ' ', 'g')
            = pg_catalog.regexp_replace(v_raw_text, '[[:space:]]+', ' ', 'g')
        )
      )
    ) then
      v_skipped_job_count := v_skipped_job_count + 1;
      continue;
    end if;

    insert into public.job_postings (
      user_id, title, source_url, raw_text, intake_source, notes
    ) values (
      v_user_id,
      'Imported job - add title',
      v_url,
      v_raw_text,
      case when v_raw_text is not null then 'pasted_text' else 'pasted_url' end,
      'Imported from your device draft. Add the job title and company before using this record.'
    );
    v_job_count := v_job_count + 1;
  end loop;

  insert into public.guest_draft_imports (user_id, draft_hash, imported_counts)
  values (
    v_user_id,
    v_hash,
    pg_catalog.jsonb_build_object(
      'profileFields', v_profile_count,
      'skills', v_skill_count,
      'entries', v_entry_count,
      'jobs', v_job_count,
      'skippedEntries', v_skipped_entry_count,
      'skippedJobs', v_skipped_job_count
    )
  );

  return query select
    'imported', v_hash, v_profile_count, v_skill_count, v_entry_count,
    v_job_count, v_skipped_entry_count, v_skipped_job_count;
end;
$function$;

revoke all on function public.import_guest_draft(jsonb, text) from public;
revoke all on function public.import_guest_draft(jsonb, text) from anon;
grant execute on function public.import_guest_draft(jsonb, text) to authenticated;
