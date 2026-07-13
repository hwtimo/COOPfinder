-- Transactional Master Profile persistence and idempotent guest-draft import.

create table if not exists public.guest_draft_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_hash text not null,
  imported_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, draft_hash)
);

create index if not exists guest_draft_imports_user_id_idx
  on public.guest_draft_imports(user_id);

alter table public.guest_draft_imports enable row level security;

drop policy if exists "guest draft imports select own" on public.guest_draft_imports;

create policy "guest draft imports select own"
on public.guest_draft_imports
for select
to authenticated
using (user_id = auth.uid());

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
  if pg_catalog.coalesce(p_profile->>'school', '') <> ''
    and p_profile->>'school' not in ('SFU', 'UBC', 'Waterloo', 'Other') then
    raise exception 'invalid school';
  end if;
  if pg_catalog.coalesce(p_profile->>'workAuthorization', '') <> ''
    and p_profile->>'workAuthorization' not in (
      'Canadian work authorization', 'Domestic students', 'International eligible'
    ) then
    raise exception 'invalid work authorization';
  end if;
  if pg_catalog.coalesce(p_profile->>'gradYear', '') <> ''
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
    pg_catalog.nullif(pg_catalog.btrim(p_profile->>'fullName'), ''),
    pg_catalog.nullif(p_profile->>'school', ''),
    pg_catalog.nullif(pg_catalog.btrim(p_profile->>'program'), ''),
    case when pg_catalog.coalesce(p_profile->>'gradYear', '') = ''
      then null else (p_profile->>'gradYear')::integer end,
    pg_catalog.nullif(pg_catalog.btrim(p_profile->>'coopTerm'), ''),
    pg_catalog.nullif(p_profile->>'workAuthorization', ''),
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

  insert into public.master_profiles (user_id, data)
  values (v_user_id, pg_catalog.jsonb_build_object('skills', pg_catalog.to_jsonb(v_skills)))
  on conflict (user_id) do update set
    data = pg_catalog.jsonb_set(
      public.master_profiles.data,
      '{skills}',
      pg_catalog.to_jsonb(v_skills),
      true
    )
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

    select pg_catalog.coalesce(pg_catalog.array_agg(pg_catalog.btrim(value)), '{}')
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

create or replace function public.import_guest_draft(
  p_draft jsonb,
  p_mode text default 'auto'
) returns table(
  result_status text,
  draft_hash text,
  imported_profile_fields integer,
  imported_skills integer,
  imported_entries integer,
  imported_jobs integer,
  skipped_entries integer,
  skipped_jobs integer
)
language plpgsql
security definer
set search_path = ''
as $$
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
  if pg_catalog.coalesce(pg_catalog.jsonb_typeof(v_profile->'targetRoles'), 'array') <> 'array'
    or pg_catalog.coalesce(pg_catalog.jsonb_typeof(v_profile->'preferredLocations'), 'array') <> 'array'
    or pg_catalog.jsonb_array_length(pg_catalog.coalesce(v_profile->'targetRoles', '[]'::jsonb)) > 12
    or pg_catalog.jsonb_array_length(pg_catalog.coalesce(v_profile->'preferredLocations', '[]'::jsonb)) > 12 then
    raise exception 'invalid guest profile arrays';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      pg_catalog.coalesce(v_profile->'targetRoles', '[]'::jsonb)
    ) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
      or pg_catalog.length(pg_catalog.btrim(item.value #>> '{}')) > 80
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      pg_catalog.coalesce(v_profile->'preferredLocations', '[]'::jsonb)
    ) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
      or pg_catalog.length(pg_catalog.btrim(item.value #>> '{}')) > 80
  ) then
    raise exception 'invalid guest profile array item';
  end if;

  select pg_catalog.coalesce(pg_catalog.array_agg(pg_catalog.btrim(value)), '{}')
  into v_incoming_targets
  from pg_catalog.jsonb_array_elements_text(
    pg_catalog.coalesce(v_profile->'targetRoles', '[]'::jsonb)
  ) as item(value)
  where pg_catalog.btrim(value) <> '' and pg_catalog.length(pg_catalog.btrim(value)) <= 80;

  select pg_catalog.coalesce(pg_catalog.array_agg(pg_catalog.btrim(value)), '{}')
  into v_incoming_locations
  from pg_catalog.jsonb_array_elements_text(
    pg_catalog.coalesce(v_profile->'preferredLocations', '[]'::jsonb)
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
        pg_catalog.coalesce(pg_catalog.btrim(v_entry->>'title'), '') = ''
        and pg_catalog.coalesce(pg_catalog.btrim(v_entry->>'text'), '') = ''
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
    v_url := pg_catalog.nullif(pg_catalog.btrim(v_job->>'url'), '');
    v_raw_text := pg_catalog.nullif(pg_catalog.btrim(v_job->>'text'), '');
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
        pg_catalog.nullif(pg_catalog.btrim(p.full_name), '') is not null
        or p.school is not null
        or pg_catalog.nullif(pg_catalog.btrim(p.program), '') is not null
        or p.grad_year is not null
        or pg_catalog.nullif(pg_catalog.btrim(p.coop_term), '') is not null
        or p.work_authorization is not null
        or pg_catalog.cardinality(p.preferred_locations) > 0
        or pg_catalog.cardinality(p.target_roles) > 0
      )
    ) or exists (
      select 1 from public.master_profiles m
      where m.user_id = v_user_id and (
        pg_catalog.nullif(pg_catalog.btrim(m.summary), '') is not null
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

  if pg_catalog.nullif(pg_catalog.btrim(v_profile_row.school), '') is null
    and pg_catalog.nullif(pg_catalog.btrim(v_profile->>'school'), '') is not null then
    v_profile_count := v_profile_count + 1;
  end if;
  if pg_catalog.nullif(pg_catalog.btrim(v_profile_row.program), '') is null
    and pg_catalog.nullif(pg_catalog.btrim(v_profile->>'program'), '') is not null then
    v_profile_count := v_profile_count + 1;
  end if;
  if pg_catalog.nullif(pg_catalog.btrim(v_profile_row.coop_term), '') is null
    and pg_catalog.nullif(pg_catalog.btrim(v_profile->>'coopTerm'), '') is not null then
    v_profile_count := v_profile_count + 1;
  end if;
  if pg_catalog.nullif(pg_catalog.btrim(v_profile_row.work_authorization), '') is null
    and pg_catalog.nullif(pg_catalog.btrim(v_profile->>'workAuthorization'), '') is not null then
    v_profile_count := v_profile_count + 1;
  end if;

  select pg_catalog.coalesce(pg_catalog.array_agg(value order by ord), '{}')
  into v_merged
  from (
    select distinct on (pg_catalog.lower(value)) value, ord
    from pg_catalog.unnest(
      pg_catalog.coalesce(v_profile_row.target_roles, '{}') || v_incoming_targets
    ) with ordinality as merged(value, ord)
    where pg_catalog.btrim(value) <> ''
    order by pg_catalog.lower(value), ord
  ) deduped;

  update public.profiles set
    school = case when pg_catalog.nullif(pg_catalog.btrim(school), '') is null
      then pg_catalog.nullif(v_profile->>'school', '') else school end,
    program = case when pg_catalog.nullif(pg_catalog.btrim(program), '') is null
      then pg_catalog.nullif(pg_catalog.btrim(v_profile->>'program'), '') else program end,
    coop_term = case when pg_catalog.nullif(pg_catalog.btrim(coop_term), '') is null
      then pg_catalog.nullif(pg_catalog.btrim(v_profile->>'coopTerm'), '') else coop_term end,
    work_authorization = case when pg_catalog.nullif(pg_catalog.btrim(work_authorization), '') is null
      then pg_catalog.nullif(v_profile->>'workAuthorization', '') else work_authorization end,
    target_roles = v_merged
  where user_id = v_user_id;

  select pg_catalog.coalesce(pg_catalog.array_agg(value order by ord), '{}')
  into v_merged
  from (
    select distinct on (pg_catalog.lower(value)) value, ord
    from pg_catalog.unnest(
      pg_catalog.coalesce(v_profile_row.preferred_locations, '{}') || v_incoming_locations
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

  select pg_catalog.coalesce(pg_catalog.array_agg(value order by ord), '{}')
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
    v_title := pg_catalog.coalesce(pg_catalog.btrim(v_entry->>'title'), '');
    v_text := pg_catalog.coalesce(pg_catalog.btrim(v_entry->>'text'), '');
    if exists (
      select 1 from public.master_profile_entries e
      where e.user_id = v_user_id
        and e.section = v_entry->>'section'
        and pg_catalog.lower(pg_catalog.coalesce(e.source_label, e.title, '')) = pg_catalog.lower(v_title)
        and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(e.entry_text), '[[:space:]]+', ' ', 'g'))
          = pg_catalog.lower(pg_catalog.regexp_replace(
              pg_catalog.btrim(pg_catalog.coalesce(pg_catalog.nullif(v_text, ''), v_title)),
              '[[:space:]]+', ' ', 'g'
            ))
    ) then
      v_skipped_entry_count := v_skipped_entry_count + 1;
      continue;
    end if;

    select pg_catalog.coalesce(pg_catalog.array_agg(pg_catalog.btrim(value)), '{}')
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
      pg_catalog.nullif(v_title, ''),
      pg_catalog.nullif(v_title, ''),
      pg_catalog.coalesce(pg_catalog.nullif(v_text, ''), v_title),
      v_entry_skills,
      true,
      pg_catalog.coalesce((
        select pg_catalog.max(sort_order) + 1
        from public.master_profile_entries
        where user_id = v_user_id
      ), 0)
    );
    v_entry_count := v_entry_count + 1;
  end loop;

  for v_job in select value from pg_catalog.jsonb_array_elements(p_draft->'stashedJobs')
  loop
    v_url := pg_catalog.nullif(pg_catalog.btrim(v_job->>'url'), '');
    v_raw_text := pg_catalog.nullif(pg_catalog.btrim(v_job->>'text'), '');

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
$$;

revoke all on function public.import_guest_draft(jsonb, text) from public;
revoke all on function public.import_guest_draft(jsonb, text) from anon;
grant execute on function public.import_guest_draft(jsonb, text) to authenticated;
