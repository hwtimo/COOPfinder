-- Atomically update an owned application deadline and append its private event.

create or replace function public.update_application_deadline(
  p_application_id uuid,
  p_deadline date
) returns table (
  result_status text,
  application_id uuid,
  application_deadline date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_previous_deadline date;
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

  select application.deadline
  into v_previous_deadline
  from public.applications as application
  where application.id = p_application_id
    and application.user_id = v_user_id
  for update;

  if not found then
    return query
    select 'unavailable'::text, null::uuid, null::date;
    return;
  end if;

  if v_previous_deadline is not distinct from p_deadline then
    return query
    select 'unchanged'::text, p_application_id, v_previous_deadline;
    return;
  end if;

  v_event_at := pg_catalog.clock_timestamp();

  update public.applications as application
  set
    deadline = p_deadline,
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
    'Deadline updated',
    'Application deadline updated.',
    v_event_at::date,
    'deadline_changed',
    v_event_at,
    pg_catalog.jsonb_build_object(
      'previous_deadline', case
        when v_previous_deadline is null then null
        else pg_catalog.to_char(v_previous_deadline, 'YYYY-MM-DD')
      end,
      'new_deadline', case
        when p_deadline is null then null
        else pg_catalog.to_char(p_deadline, 'YYYY-MM-DD')
      end
    )
  );

  return query
  select 'updated'::text, p_application_id, p_deadline;
end;
$$;

comment on function public.update_application_deadline(uuid, date) is
  'Atomically changes one caller-owned application deadline and appends exactly one minimal deadline_changed event. Equal values, including repeated clears, return unchanged without writing.';

revoke all on function public.update_application_deadline(uuid, date) from public;
revoke all on function public.update_application_deadline(uuid, date) from anon;
grant execute on function public.update_application_deadline(uuid, date) to authenticated;
