-- Atomically create application tracking from a user-owned private saved job.

create or replace function public.create_application_from_job(
  p_job_posting_id uuid
) returns table (
  result_status text,
  application_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_application_id uuid;
  v_event_at timestamptz := pg_catalog.clock_timestamp();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication required';
  end if;

  if p_job_posting_id is null or not exists (
    select 1
    from public.job_postings as job
    where job.id = p_job_posting_id
      and job.user_id = v_user_id
  ) then
    return query select 'unavailable'::text, null::uuid;
    return;
  end if;

  -- Serialize this user/job pair so concurrent retries share the same result.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || ':' || p_job_posting_id::text,
      0
    )
  );

  select application.id
  into v_application_id
  from public.applications as application
  where application.user_id = v_user_id
    and application.job_posting_id = p_job_posting_id;

  if v_application_id is not null then
    return query select 'already_exists'::text, v_application_id;
    return;
  end if;

  insert into public.applications (
    user_id,
    job_posting_id,
    status
  ) values (
    v_user_id,
    p_job_posting_id,
    'saved'
  )
  returning id into v_application_id;

  insert into public.application_timeline_events (
    user_id,
    application_id,
    label,
    detail,
    event_date,
    event_type,
    event_at,
    metadata
  ) values (
    v_user_id,
    v_application_id,
    'Application tracking started',
    'Created from a saved private job.',
    v_event_at::date,
    'application_created',
    v_event_at,
    pg_catalog.jsonb_build_object('source', 'private_saved_job')
  );

  return query select 'created'::text, v_application_id;
end;
$$;

comment on function public.create_application_from_job(uuid) is
  'Creates one saved application and its initial timeline event for the caller-owned private job. Sequential or concurrent retries return already_exists with the original application ID and do not add events or reset application fields.';

revoke all on function public.create_application_from_job(uuid) from public;
revoke all on function public.create_application_from_job(uuid) from anon;
grant execute on function public.create_application_from_job(uuid) to authenticated;
