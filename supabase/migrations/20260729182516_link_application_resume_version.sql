-- Persist the exact owned tailored-resume version used when tracking a job.

alter table public.applications
  add column resume_version_id uuid;

alter table public.resume_versions
  add constraint resume_versions_id_user_id_job_posting_id_key
  unique (id, user_id, job_posting_id);

alter table public.applications
  add constraint applications_resume_version_owner_job_fkey
  foreign key (resume_version_id, user_id, job_posting_id)
  references public.resume_versions(id, user_id, job_posting_id)
  on delete set null (resume_version_id);

create index applications_resume_version_id_idx
  on public.applications(resume_version_id)
  where resume_version_id is not null;

drop function public.create_application_from_job(uuid);

create function public.create_application_from_job(
  p_job_posting_id uuid,
  p_resume_version_id uuid default null
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

  if p_resume_version_id is not null and not exists (
    select 1
    from public.resume_versions as version
    where version.id = p_resume_version_id
      and version.user_id = v_user_id
      and version.job_posting_id = p_job_posting_id
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
    resume_version_id,
    status
  ) values (
    v_user_id,
    p_job_posting_id,
    p_resume_version_id,
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

comment on column public.applications.resume_version_id is
  'Optional immutable tailored-resume version selected when application tracking was created.';

comment on function public.create_application_from_job(uuid, uuid) is
  'Creates one saved application and its initial timeline event for the caller-owned private job, optionally linked to a caller-owned resume version for the same job. Sequential or concurrent retries return already_exists with the original application ID and do not add events or reset application fields.';

revoke all on function public.create_application_from_job(uuid, uuid)
  from public;
revoke all on function public.create_application_from_job(uuid, uuid)
  from anon;
revoke all on function public.create_application_from_job(uuid, uuid)
  from authenticated;
revoke all on function public.create_application_from_job(uuid, uuid)
  from service_role;
grant execute on function public.create_application_from_job(uuid, uuid)
  to authenticated, service_role;
