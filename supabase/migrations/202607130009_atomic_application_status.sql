-- Atomically update an owned application status and append its timeline event.

create or replace function public.update_application_status(
  p_application_id uuid,
  p_status text
) returns table (
  result_status text,
  application_id uuid,
  application_status text,
  applied_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_previous_status text;
  v_applied_at timestamptz;
  v_event_at timestamptz;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication required';
  end if;

  if p_application_id is null then
    raise exception using
      errcode = '22023',
      message = 'application ID is required';
  end if;

  if p_status is null or p_status not in (
    'saved',
    'tailoring',
    'ready',
    'applied',
    'interview',
    'offer',
    'rejected'
  ) then
    raise exception using
      errcode = '22023',
      message = 'application status is invalid';
  end if;

  select application.status, application.applied_at
  into v_previous_status, v_applied_at
  from public.applications as application
  where application.id = p_application_id
    and application.user_id = v_user_id
  for update;

  if not found then
    return query
    select
      'unavailable'::text,
      null::uuid,
      null::text,
      null::timestamptz;
    return;
  end if;

  if v_previous_status = p_status then
    return query
    select
      'unchanged'::text,
      p_application_id,
      v_previous_status,
      v_applied_at;
    return;
  end if;

  v_event_at := pg_catalog.clock_timestamp();

  update public.applications as application
  set
    status = p_status,
    applied_at = case
      when p_status = 'applied' and application.applied_at is null
        then v_event_at
      else application.applied_at
    end,
    updated_at = v_event_at
  where application.id = p_application_id
    and application.user_id = v_user_id
  returning application.applied_at into v_applied_at;

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
    p_application_id,
    'Status changed',
    'Application status updated.',
    v_event_at::date,
    'status_changed',
    v_event_at,
    pg_catalog.jsonb_build_object(
      'previous_status', v_previous_status,
      'new_status', p_status
    )
  );

  return query
  select
    'updated'::text,
    p_application_id,
    p_status,
    v_applied_at;
end;
$$;

comment on function public.update_application_status(uuid, text) is
  'Atomically changes one caller-owned application status and appends exactly one minimal status_changed timeline event. No-op requests return unchanged without writing an event.';

revoke all on function public.update_application_status(uuid, text) from public;
revoke all on function public.update_application_status(uuid, text) from anon;
grant execute on function public.update_application_status(uuid, text) to authenticated;
