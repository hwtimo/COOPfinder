-- Add one owner-private interview date and its atomic timeline mutation.

alter table public.applications
  add column interview_date date;

alter table public.application_timeline_events
  drop constraint application_timeline_events_event_type_check;

alter table public.application_timeline_events
  add constraint application_timeline_events_event_type_check
  check (
    event_type in (
      'application_created',
      'status_changed',
      'note_updated',
      'deadline_changed',
      'interview_date_changed',
      'follow_up_changed',
      'marked_applied',
      'activity'
    )
  ) not valid;

alter table public.application_timeline_events
  validate constraint application_timeline_events_event_type_check;

create or replace function public.update_application_interview_date(
  p_application_id uuid,
  p_interview_date date
) returns table (
  result_status text,
  application_id uuid,
  application_interview_date date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_previous_interview_date date;
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

  select application.interview_date
  into v_previous_interview_date
  from public.applications as application
  where application.id = p_application_id
    and application.user_id = v_user_id
  for update;

  if not found then
    return query
    select 'unavailable'::text, null::uuid, null::date;
    return;
  end if;

  if v_previous_interview_date is not distinct from p_interview_date then
    return query
    select 'unchanged'::text, p_application_id, v_previous_interview_date;
    return;
  end if;

  v_event_at := pg_catalog.clock_timestamp();

  update public.applications as application
  set
    interview_date = p_interview_date,
    updated_at = v_event_at
  where application.id = p_application_id
    and application.user_id = v_user_id;

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
    'Interview date updated',
    'Application interview date updated.',
    v_event_at::date,
    'interview_date_changed',
    v_event_at,
    pg_catalog.jsonb_build_object(
      'previous_interview_date', case
        when v_previous_interview_date is null then null
        else pg_catalog.to_char(v_previous_interview_date, 'YYYY-MM-DD')
      end,
      'new_interview_date', case
        when p_interview_date is null then null
        else pg_catalog.to_char(p_interview_date, 'YYYY-MM-DD')
      end
    )
  );

  return query
  select 'updated'::text, p_application_id, p_interview_date;
end;
$$;

comment on function public.update_application_interview_date(uuid, date) is
  'Atomically changes one caller-owned application interview date and appends exactly one minimal interview_date_changed event. Equal values, including repeated clears, return unchanged without writing.';

revoke all on function public.update_application_interview_date(uuid, date)
  from public;
revoke all on function public.update_application_interview_date(uuid, date)
  from anon;
grant execute on function public.update_application_interview_date(uuid, date)
  to authenticated;
