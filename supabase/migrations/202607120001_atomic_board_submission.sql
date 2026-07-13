-- Authenticated board submission: atomically preserve a private job copy and
-- create an inactive public-board candidate for moderation.

-- The v3 board-only RPC is superseded for authenticated product flows. Keep
-- the function definition for migration compatibility, but remove direct use.
revoke execute on function public.submit_board_job(
  text, text, text, text, text, date, text, text
) from authenticated;

create or replace function public.submit_board_job_with_private_copy(
  p_source_url text,
  p_title text,
  p_company_name text,
  p_location text,
  p_term text,
  p_work_mode text,
  p_deadline date,
  p_keywords text[],
  p_note text,
  p_raw_text text
) returns table (
  board_job_id uuid,
  job_posting_id uuid,
  moderation_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_url text := pg_catalog.btrim(p_source_url);
  v_title text := pg_catalog.btrim(p_title);
  v_company_name text := pg_catalog.btrim(p_company_name);
  v_location text := nullif(pg_catalog.btrim(p_location), '');
  v_term text := nullif(pg_catalog.btrim(p_term), '');
  v_work_mode text := nullif(pg_catalog.btrim(p_work_mode), '');
  v_note text := nullif(pg_catalog.btrim(p_note), '');
  v_raw_text text := nullif(pg_catalog.btrim(p_raw_text), '');
  v_keywords text[] := coalesce(p_keywords, '{}'::text[]);
  v_company_id uuid;
  v_board_job_id uuid;
  v_job_posting_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication required';
  end if;

  if v_source_url is null
    or pg_catalog.char_length(v_source_url) > 2048
    or v_source_url !~* '^https?://[^/[:space:]]+(/[^[:space:]]*)?$'
  then
    raise exception using
      errcode = '22023',
      message = 'source URL must be a valid http or https URL';
  end if;

  if v_title is null or v_title = '' or pg_catalog.char_length(v_title) > 200 then
    raise exception using
      errcode = '22023',
      message = 'title must be between 1 and 200 characters';
  end if;

  if v_company_name is null
    or v_company_name = ''
    or pg_catalog.char_length(v_company_name) > 160
  then
    raise exception using
      errcode = '22023',
      message = 'company must be between 1 and 160 characters';
  end if;

  if v_location is not null and pg_catalog.char_length(v_location) > 160 then
    raise exception using
      errcode = '22023',
      message = 'location must be 160 characters or fewer';
  end if;

  if v_term is not null and pg_catalog.char_length(v_term) > 120 then
    raise exception using
      errcode = '22023',
      message = 'term must be 120 characters or fewer';
  end if;

  if v_work_mode is not null
    and v_work_mode not in ('Remote', 'Hybrid', 'On-site')
  then
    raise exception using
      errcode = '22023',
      message = 'work mode is invalid';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'submission note must be 2000 characters or fewer';
  end if;

  if v_raw_text is not null and pg_catalog.char_length(v_raw_text) > 100000 then
    raise exception using
      errcode = '22023',
      message = 'job description must be 100000 characters or fewer';
  end if;

  if pg_catalog.cardinality(v_keywords) > 20 then
    raise exception using
      errcode = '22023',
      message = 'use no more than 20 skills or tags';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(v_keywords) as keyword(value)
    where keyword.value is null
      or pg_catalog.btrim(keyword.value) = ''
      or pg_catalog.char_length(pg_catalog.btrim(keyword.value)) > 80
  ) then
    raise exception using
      errcode = '22023',
      message = 'each skill or tag must be between 1 and 80 characters';
  end if;

  select coalesce(
    pg_catalog.array_agg(normalized.keyword order by normalized.keyword),
    '{}'::text[]
  )
  into v_keywords
  from (
    select distinct pg_catalog.btrim(keyword.value) as keyword
    from pg_catalog.unnest(v_keywords) as keyword(value)
  ) as normalized;

  -- Serialize company lookup/creation by normalized name so the existing
  -- case-insensitive unique index cannot produce a race between submissions.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.lower(v_company_name), 0)
  );

  select companies.id
  into v_company_id
  from public.companies
  where pg_catalog.lower(companies.name) = pg_catalog.lower(v_company_name)
  order by companies.created_at asc
  limit 1;

  if v_company_id is null then
    insert into public.companies (created_by, name)
    values (v_user_id, v_company_name)
    returning id into v_company_id;
  end if;

  insert into public.board_jobs (
    title,
    company_name,
    location,
    term,
    work_mode,
    deadline,
    keywords,
    source_url,
    summary,
    status,
    submitted_by,
    submitted_url,
    submission_note,
    reviewed_at,
    review_note,
    is_active
  ) values (
    v_title,
    v_company_name,
    v_location,
    v_term,
    v_work_mode,
    p_deadline,
    v_keywords,
    v_source_url,
    '',
    'pending_review',
    v_user_id,
    v_source_url,
    v_note,
    null,
    null,
    false
  )
  returning id into v_board_job_id;

  insert into public.job_postings (
    user_id,
    company_id,
    title,
    location,
    term,
    work_mode,
    deadline,
    source_url,
    raw_text,
    status,
    notes,
    intake_source,
    board_job_id
  ) values (
    v_user_id,
    v_company_id,
    v_title,
    v_location,
    v_term,
    v_work_mode,
    p_deadline,
    v_source_url,
    v_raw_text,
    'saved',
    v_note,
    case when v_raw_text is null then 'pasted_url' else 'pasted_text' end,
    v_board_job_id
  )
  returning id into v_job_posting_id;

  return query
  select v_board_job_id, v_job_posting_id, 'pending_review'::text;
end;
$$;

comment on function public.submit_board_job_with_private_copy(
  text, text, text, text, text, text, date, text[], text, text
) is
  'Atomically creates a user-owned private job posting and an inactive pending board candidate. Raw job text is stored only on job_postings.';

revoke all on function public.submit_board_job_with_private_copy(
  text, text, text, text, text, text, date, text[], text, text
) from public;

revoke all on function public.submit_board_job_with_private_copy(
  text, text, text, text, text, text, date, text[], text, text
) from anon;

grant execute on function public.submit_board_job_with_private_copy(
  text, text, text, text, text, text, date, text[], text, text
) to authenticated;
