alter table public.master_profile_entries
add column resume_fragments jsonb not null default '[]'::jsonb;

create function public.normalize_resume_source_fragments(
  p_fragments jsonb
) returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_fragment jsonb;
  v_text text;
  v_fragment_id text;
  v_order integer;
  v_tag jsonb;
  v_tag_text text;
  v_tag_key text;
  v_tags jsonb;
  v_seen_tags text[];
  v_seen_ids text[] := array[]::text[];
  v_seen_orders integer[] := array[]::integer[];
  v_result jsonb := '[]'::jsonb;
begin
  if p_fragments is null
    or pg_catalog.jsonb_typeof(p_fragments) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_fragments) > 20 then
    raise exception 'invalid resume fragments';
  end if;

  for v_fragment in
    select item.value
    from pg_catalog.jsonb_array_elements(p_fragments) as item(value)
  loop
    if pg_catalog.jsonb_typeof(v_fragment) is distinct from 'object'
      or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_fragment)) <> 6
      or exists (
        select 1
        from pg_catalog.jsonb_object_keys(v_fragment) as fragment_key(key)
        where fragment_key.key not in (
          'fragmentId', 'text', 'evidenceTags', 'confirmed', 'order', 'provenance'
        )
      )
      or not (v_fragment ?& array[
        'fragmentId', 'text', 'evidenceTags', 'confirmed', 'order', 'provenance'
      ])
      or pg_catalog.jsonb_typeof(v_fragment->'fragmentId') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_fragment->'text') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_fragment->'evidenceTags') is distinct from 'array'
      or pg_catalog.jsonb_typeof(v_fragment->'confirmed') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(v_fragment->'order') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_fragment->'provenance') is distinct from 'string'
      or v_fragment->>'provenance' <> 'manual' then
      raise exception 'invalid resume fragment';
    end if;

    v_fragment_id := v_fragment->>'fragmentId';
    if v_fragment_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or pg_catalog.lower(v_fragment_id) = any(v_seen_ids) then
      raise exception 'invalid resume fragment id';
    end if;

    if v_fragment->>'order' !~ '^(0|[1-9][0-9]*)$' then
      raise exception 'invalid resume fragment order';
    end if;
    v_order := (v_fragment->>'order')::integer;
    if v_order not between 0 and 19 or v_order = any(v_seen_orders) then
      raise exception 'invalid resume fragment order';
    end if;

    v_text := pg_catalog.regexp_replace(
      pg_catalog.btrim(v_fragment->>'text'),
      '[[:space:]]+',
      ' ',
      'g'
    );
    if pg_catalog.char_length(v_text) not between 1 and 500 then
      raise exception 'invalid resume fragment text';
    end if;

    if pg_catalog.jsonb_array_length(v_fragment->'evidenceTags') > 20 then
      raise exception 'too many resume fragment tags';
    end if;
    v_tags := '[]'::jsonb;
    v_seen_tags := array[]::text[];
    for v_tag in
      select tag.value
      from pg_catalog.jsonb_array_elements(v_fragment->'evidenceTags') as tag(value)
    loop
      if pg_catalog.jsonb_typeof(v_tag) is distinct from 'string' then
        raise exception 'invalid resume fragment tag';
      end if;
      v_tag_text := pg_catalog.regexp_replace(
        pg_catalog.btrim(v_tag #>> '{}'),
        '[[:space:]]+',
        ' ',
        'g'
      );
      if pg_catalog.char_length(v_tag_text) > 80 then
        raise exception 'resume fragment tag too long';
      end if;
      if v_tag_text = '' then
        continue;
      end if;
      v_tag_key := pg_catalog.lower(v_tag_text);
      if v_tag_key = any(v_seen_tags) then
        continue;
      end if;
      v_seen_tags := pg_catalog.array_append(v_seen_tags, v_tag_key);
      v_tags := v_tags || pg_catalog.jsonb_build_array(v_tag_text);
    end loop;

    v_seen_ids := pg_catalog.array_append(
      v_seen_ids,
      pg_catalog.lower(v_fragment_id)
    );
    v_seen_orders := pg_catalog.array_append(v_seen_orders, v_order);
    v_result := v_result || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'fragmentId', v_fragment_id,
        'text', v_text,
        'evidenceTags', v_tags,
        'confirmed', (v_fragment->>'confirmed')::boolean,
        'order', v_order,
        'provenance', 'manual'
      )
    );
  end loop;

  select coalesce(
    pg_catalog.jsonb_agg(item.value order by (item.value->>'order')::integer),
    '[]'::jsonb
  )
  into v_result
  from pg_catalog.jsonb_array_elements(v_result) as item(value);
  return v_result;
end;
$$;

revoke all on function public.normalize_resume_source_fragments(jsonb) from public;
revoke all on function public.normalize_resume_source_fragments(jsonb) from anon;
revoke all on function public.normalize_resume_source_fragments(jsonb) from authenticated;
revoke all on function public.normalize_resume_source_fragments(jsonb) from service_role;

alter function public.save_master_profile(jsonb, jsonb, jsonb)
rename to save_master_profile_without_resume_fragments;

revoke all on function public.save_master_profile_without_resume_fragments(jsonb, jsonb, jsonb) from public;
revoke all on function public.save_master_profile_without_resume_fragments(jsonb, jsonb, jsonb) from anon;
revoke all on function public.save_master_profile_without_resume_fragments(jsonb, jsonb, jsonb) from authenticated;
revoke all on function public.save_master_profile_without_resume_fragments(jsonb, jsonb, jsonb) from service_role;

create function public.save_master_profile(
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
  v_existing_entries jsonb := '[]'::jsonb;
  v_entry jsonb;
  v_entry_index integer;
  v_fragments jsonb;
  v_saved_entries integer;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_entries is null or pg_catalog.jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'invalid entries payload';
  end if;

  for v_entry in
    select item.value
    from pg_catalog.jsonb_array_elements(p_entries) as item(value)
  loop
    if pg_catalog.jsonb_typeof(v_entry) is distinct from 'object' then
      raise exception 'invalid profile entry';
    end if;
    if v_entry ? 'resumeFragments' then
      perform public.normalize_resume_source_fragments(v_entry->'resumeFragments');
    end if;
  end loop;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'section', entry.section,
        'source', coalesce(entry.source_label, entry.title, ''),
        'text', entry.entry_text,
        'sortOrder', entry.sort_order,
        'resumeFragments', entry.resume_fragments
      ) order by entry.sort_order, entry.created_at
    ),
    '[]'::jsonb
  )
  into v_existing_entries
  from public.master_profile_entries as entry
  where entry.user_id = v_user_id;

  select result.saved_entries
  into v_saved_entries
  from public.save_master_profile_without_resume_fragments(
    p_profile,
    p_skills,
    p_entries
  ) as result;

  select profile.id
  into v_master_profile_id
  from public.master_profiles as profile
  where profile.user_id = v_user_id;

  for v_entry, v_entry_index in
    select item.value, (item.ordinality - 1)::integer
    from pg_catalog.jsonb_array_elements(p_entries) with ordinality as item(value, ordinality)
  loop
    if v_entry ? 'resumeFragments' then
      v_fragments := public.normalize_resume_source_fragments(
        v_entry->'resumeFragments'
      );
    else
      select existing.value->'resumeFragments'
      into v_fragments
      from pg_catalog.jsonb_array_elements(v_existing_entries) as existing(value)
      where (existing.value->>'sortOrder')::integer = v_entry_index
        and existing.value->>'section' = v_entry->>'section'
        and pg_catalog.btrim(existing.value->>'source') = pg_catalog.btrim(v_entry->>'source')
        and pg_catalog.btrim(existing.value->>'text') = pg_catalog.btrim(v_entry->>'text')
      limit 1;
      v_fragments := coalesce(v_fragments, '[]'::jsonb);
    end if;

    update public.master_profile_entries as entry
    set resume_fragments = v_fragments
    where entry.user_id = v_user_id
      and entry.master_profile_id = v_master_profile_id
      and entry.sort_order = v_entry_index;
  end loop;

  return query select v_saved_entries;
end;
$$;

revoke all on function public.save_master_profile(jsonb, jsonb, jsonb) from public;
revoke all on function public.save_master_profile(jsonb, jsonb, jsonb) from anon;
revoke all on function public.save_master_profile(jsonb, jsonb, jsonb) from service_role;
grant execute on function public.save_master_profile(jsonb, jsonb, jsonb) to authenticated;
