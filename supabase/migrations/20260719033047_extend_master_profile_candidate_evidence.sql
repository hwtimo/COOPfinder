-- Extend atomic Master Profile persistence with optional categorized candidate
-- evidence while preserving the existing RPC, ownership, and legacy payloads.

create or replace function public.save_master_profile(
  p_profile jsonb,
  p_skills jsonb,
  p_entries jsonb
) returns table(saved_entries integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_master_profile_id uuid;
  v_entry jsonb;
  v_skill jsonb;
  v_skills text[] := '{}';
  v_entry_skills text[];
  v_saved_entries integer := 0;
  v_candidate jsonb;
  v_normalized_candidate jsonb := '{}'::jsonb;
  v_candidate_field text;
  v_candidate_field_json jsonb;
  v_candidate_item jsonb;
  v_candidate_array jsonb;
  v_candidate_text text;
  v_candidate_key text;
  v_seen_candidate_keys text[];
  v_candidate_max_items integer;
  v_candidate_max_length integer;
  v_language_proficiency text;
  v_master_data jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_profile is null or pg_catalog.jsonb_typeof(p_profile) <> 'object' then
    raise exception 'invalid profile payload';
  end if;
  if p_skills is null or pg_catalog.jsonb_typeof(p_skills) <> 'array'
    or pg_catalog.jsonb_array_length(p_skills) > 60 then
    raise exception 'invalid skills payload';
  end if;
  if p_entries is null or pg_catalog.jsonb_typeof(p_entries) <> 'array'
    or pg_catalog.jsonb_array_length(p_entries) > 100 then
    raise exception 'invalid entries payload';
  end if;

  if pg_catalog.length(pg_catalog.btrim(p_profile->>'fullName')) > 160
    or pg_catalog.length(pg_catalog.btrim(p_profile->>'program')) > 120
    or pg_catalog.length(pg_catalog.btrim(p_profile->>'coopTerm')) > 80 then
    raise exception 'profile field too long';
  end if;
  if coalesce(p_profile->>'school', '') <> ''
    and p_profile->>'school' not in ('SFU', 'UBC', 'Waterloo', 'Other') then
    raise exception 'invalid school';
  end if;
  if coalesce(p_profile->>'workAuthorization', '') <> ''
    and p_profile->>'workAuthorization' not in (
      'Canadian work authorization', 'Domestic students', 'International eligible'
    ) then
    raise exception 'invalid work authorization';
  end if;
  if coalesce(p_profile->>'gradYear', '') <> ''
    and (
      p_profile->>'gradYear' !~ '^[0-9]{4}$'
      or (p_profile->>'gradYear')::integer not between 2000 and 2200
    ) then
    raise exception 'invalid graduation year';
  end if;
  if pg_catalog.jsonb_typeof(p_profile->'preferredLocations') <> 'array'
    or pg_catalog.jsonb_array_length(p_profile->'preferredLocations') > 12
    or pg_catalog.jsonb_typeof(p_profile->'targetRoles') <> 'array'
    or pg_catalog.jsonb_array_length(p_profile->'targetRoles') > 12 then
    raise exception 'invalid profile arrays';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_profile->'preferredLocations') as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_profile->'targetRoles') as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
  ) then
    raise exception 'invalid profile array item';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(p_profile->'preferredLocations') as item(value)
    where pg_catalog.length(pg_catalog.btrim(item.value)) > 80
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(p_profile->'targetRoles') as item(value)
    where pg_catalog.length(pg_catalog.btrim(item.value)) > 80
  ) then
    raise exception 'profile array item too long';
  end if;

  if p_profile ? 'candidateEvidence' then
    v_candidate := p_profile->'candidateEvidence';
    if pg_catalog.jsonb_typeof(v_candidate) is distinct from 'object'
      or exists (
        select 1
        from pg_catalog.jsonb_object_keys(v_candidate) as candidate_key(key)
        where candidate_key.key not in (
          'technologies', 'softSkills', 'certifications', 'languages'
        )
      ) then
      raise exception 'invalid candidate evidence';
    end if;

    foreach v_candidate_field in array array[
      'technologies', 'softSkills', 'certifications'
    ]::text[] loop
      if not (v_candidate ? v_candidate_field) then
        continue;
      end if;

      v_candidate_field_json := v_candidate->v_candidate_field;
      if pg_catalog.jsonb_typeof(v_candidate_field_json) is distinct from 'array' then
        raise exception 'invalid candidate evidence list';
      end if;

      if v_candidate_field = 'certifications' then
        v_candidate_max_items := 40;
        v_candidate_max_length := 160;
      else
        v_candidate_max_items := 60;
        v_candidate_max_length := 80;
      end if;
      if pg_catalog.jsonb_array_length(v_candidate_field_json) > v_candidate_max_items then
        raise exception 'candidate evidence list too long';
      end if;

      v_candidate_array := '[]'::jsonb;
      v_seen_candidate_keys := array[]::text[];
      for v_candidate_item in
        select item.value
        from pg_catalog.jsonb_array_elements(v_candidate_field_json) as item(value)
      loop
        if pg_catalog.jsonb_typeof(v_candidate_item) is distinct from 'string' then
          raise exception 'invalid candidate evidence item';
        end if;
        v_candidate_text := pg_catalog.regexp_replace(
          pg_catalog.btrim(v_candidate_item #>> '{}'),
          '[[:space:]]+',
          ' ',
          'g'
        );
        if pg_catalog.char_length(v_candidate_text) > v_candidate_max_length then
          raise exception 'candidate evidence item too long';
        end if;
        if v_candidate_text = '' then
          continue;
        end if;
        v_candidate_key := pg_catalog.lower(v_candidate_text);
        if v_candidate_key = any(v_seen_candidate_keys) then
          continue;
        end if;
        v_seen_candidate_keys := pg_catalog.array_append(
          v_seen_candidate_keys,
          v_candidate_key
        );
        v_candidate_array := v_candidate_array || pg_catalog.jsonb_build_array(
          v_candidate_text
        );
      end loop;
      v_normalized_candidate := pg_catalog.jsonb_set(
        v_normalized_candidate,
        array[v_candidate_field],
        v_candidate_array,
        true
      );
    end loop;

    if v_candidate ? 'languages' then
      v_candidate_field_json := v_candidate->'languages';
      if pg_catalog.jsonb_typeof(v_candidate_field_json) is distinct from 'array'
        or pg_catalog.jsonb_array_length(v_candidate_field_json) > 20 then
        raise exception 'invalid candidate languages';
      end if;

      v_candidate_array := '[]'::jsonb;
      v_seen_candidate_keys := array[]::text[];
      for v_candidate_item in
        select item.value
        from pg_catalog.jsonb_array_elements(v_candidate_field_json) as item(value)
      loop
        if pg_catalog.jsonb_typeof(v_candidate_item) is distinct from 'object'
          or not (v_candidate_item ? 'language')
          or pg_catalog.jsonb_typeof(v_candidate_item->'language') is distinct from 'string'
          or exists (
            select 1
            from pg_catalog.jsonb_object_keys(v_candidate_item) as language_key(key)
            where language_key.key not in ('language', 'proficiency')
          ) then
          raise exception 'invalid candidate language';
        end if;

        if v_candidate_item ? 'proficiency' then
          if pg_catalog.jsonb_typeof(v_candidate_item->'proficiency') is distinct from 'string'
            or v_candidate_item->>'proficiency' not in (
              'basic', 'conversational', 'professional', 'fluent', 'native'
            ) then
            raise exception 'invalid candidate language proficiency';
          end if;
          v_language_proficiency := v_candidate_item->>'proficiency';
        else
          v_language_proficiency := null;
        end if;

        v_candidate_text := pg_catalog.regexp_replace(
          pg_catalog.btrim(v_candidate_item->>'language'),
          '[[:space:]]+',
          ' ',
          'g'
        );
        if pg_catalog.char_length(v_candidate_text) > 80 then
          raise exception 'candidate language too long';
        end if;
        if v_candidate_text = '' then
          continue;
        end if;
        v_candidate_key := pg_catalog.lower(v_candidate_text);
        if v_candidate_key = any(v_seen_candidate_keys) then
          continue;
        end if;
        v_seen_candidate_keys := pg_catalog.array_append(
          v_seen_candidate_keys,
          v_candidate_key
        );
        v_candidate_item := pg_catalog.jsonb_build_object(
          'language', v_candidate_text
        );
        if v_language_proficiency is not null then
          v_candidate_item := v_candidate_item || pg_catalog.jsonb_build_object(
            'proficiency', v_language_proficiency
          );
        end if;
        v_candidate_array := v_candidate_array || pg_catalog.jsonb_build_array(
          v_candidate_item
        );
      end loop;
      v_normalized_candidate := pg_catalog.jsonb_set(
        v_normalized_candidate,
        '{languages}',
        v_candidate_array,
        true
      );
    end if;
  end if;

  for v_skill in select value from pg_catalog.jsonb_array_elements(p_skills)
  loop
    if pg_catalog.jsonb_typeof(v_skill) <> 'string'
      or pg_catalog.length(pg_catalog.btrim(v_skill #>> '{}')) > 80 then
      raise exception 'invalid skill';
    end if;
    if pg_catalog.btrim(v_skill #>> '{}') <> '' then
      v_skills := pg_catalog.array_append(v_skills, pg_catalog.btrim(v_skill #>> '{}'));
    end if;
  end loop;

  insert into public.profiles (
    user_id, full_name, school, program, grad_year, coop_term,
    work_authorization, preferred_locations, target_roles
  ) values (
    v_user_id,
    nullif(pg_catalog.btrim(p_profile->>'fullName'), ''),
    nullif(p_profile->>'school', ''),
    nullif(pg_catalog.btrim(p_profile->>'program'), ''),
    case when coalesce(p_profile->>'gradYear', '') = ''
      then null else (p_profile->>'gradYear')::integer end,
    nullif(pg_catalog.btrim(p_profile->>'coopTerm'), ''),
    nullif(p_profile->>'workAuthorization', ''),
    array(
      select pg_catalog.btrim(value)
      from pg_catalog.jsonb_array_elements_text(p_profile->'preferredLocations') as item(value)
      where pg_catalog.btrim(value) <> ''
    ),
    array(
      select pg_catalog.btrim(value)
      from pg_catalog.jsonb_array_elements_text(p_profile->'targetRoles') as item(value)
      where pg_catalog.btrim(value) <> ''
    )
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    school = excluded.school,
    program = excluded.program,
    grad_year = excluded.grad_year,
    coop_term = excluded.coop_term,
    work_authorization = excluded.work_authorization,
    preferred_locations = excluded.preferred_locations,
    target_roles = excluded.target_roles;

  v_master_data := pg_catalog.jsonb_build_object(
    'skills', pg_catalog.to_jsonb(v_skills)
  );
  if p_profile ? 'candidateEvidence' then
    v_master_data := v_master_data || pg_catalog.jsonb_build_object(
      'candidateEvidence', v_normalized_candidate
    );
  end if;

  insert into public.master_profiles (user_id, data)
  values (v_user_id, v_master_data)
  on conflict (user_id) do update set
    data = case
      when p_profile ? 'candidateEvidence' then
        pg_catalog.jsonb_set(
          pg_catalog.jsonb_set(
            public.master_profiles.data,
            '{skills}',
            pg_catalog.to_jsonb(v_skills),
            true
          ),
          '{candidateEvidence}',
          v_normalized_candidate,
          true
        )
      else
        pg_catalog.jsonb_set(
          public.master_profiles.data,
          '{skills}',
          pg_catalog.to_jsonb(v_skills),
          true
        )
    end
  returning id into v_master_profile_id;

  delete from public.master_profile_entries
  where user_id = v_user_id and master_profile_id = v_master_profile_id;

  for v_entry in select value from pg_catalog.jsonb_array_elements(p_entries)
  loop
    if pg_catalog.jsonb_typeof(v_entry) <> 'object'
      or v_entry->>'section' not in (
        'education', 'experience', 'project', 'skills', 'certification', 'volunteer'
      )
      or pg_catalog.length(pg_catalog.btrim(v_entry->>'source')) not between 1 and 160
      or pg_catalog.length(pg_catalog.btrim(v_entry->>'text')) not between 1 and 5000
      or pg_catalog.jsonb_typeof(v_entry->'skills') <> 'array'
      or pg_catalog.jsonb_array_length(v_entry->'skills') > 30
      or v_entry->>'confirmed' not in ('true', 'false') then
      raise exception 'invalid profile entry';
    end if;
    if exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(v_entry->'skills') as item(value)
      where pg_catalog.length(pg_catalog.btrim(item.value)) > 80
    ) then
      raise exception 'entry skill too long';
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
      pg_catalog.btrim(v_entry->>'source'),
      pg_catalog.btrim(v_entry->>'source'),
      pg_catalog.btrim(v_entry->>'text'),
      v_entry_skills,
      (v_entry->>'confirmed')::boolean,
      v_saved_entries
    );
    v_saved_entries := v_saved_entries + 1;
  end loop;

  return query select v_saved_entries;
end;
$$;

revoke all on function public.save_master_profile(jsonb, jsonb, jsonb) from public;
revoke all on function public.save_master_profile(jsonb, jsonb, jsonb) from anon;
grant execute on function public.save_master_profile(jsonb, jsonb, jsonb) to authenticated;
