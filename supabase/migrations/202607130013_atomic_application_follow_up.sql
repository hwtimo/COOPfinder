-- Atomically update an owned application follow-up and append its private event.

create or replace function public.update_application_follow_up(
  p_application_id uuid,
  p_follow_up_due timestamptz
) returns table (
  result_status text,
  application_id uuid,
  application_follow_up_due timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_previous_follow_up_due timestamptz;
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

  select application.follow_up_due
  into v_previous_follow_up_due
  from public.applications as application
  where application.id = p_application_id
    and application.user_id = v_user_id
  for update;

  if not found then
    return query
    select 'unavailable'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if v_previous_follow_up_due is not distinct from p_follow_up_due then
    return query
    select 'unchanged'::text, p_application_id, v_previous_follow_up_due;
    return;
  end if;

  v_event_at := pg_catalog.clock_timestamp();

  update public.applications as application
  set
    follow_up_due = p_follow_up_due,
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
    'Follow-up updated',
    'Application follow-up updated.',
    v_event_at::date,
    'follow_up_changed',
    v_event_at,
    pg_catalog.jsonb_build_object(
      'previous_follow_up_due', case
        when v_previous_follow_up_due is null then null
        else pg_catalog.to_char(
          v_previous_follow_up_due at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
        )
      end,
      'new_follow_up_due', case
        when p_follow_up_due is null then null
        else pg_catalog.to_char(
          p_follow_up_due at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
        )
      end
    )
  );

  return query
  select 'updated'::text, p_application_id, p_follow_up_due;
end;
$$;

comment on function public.update_application_follow_up(uuid, timestamptz) is
  'Atomically changes one caller-owned application follow-up timestamp and appends exactly one minimal follow_up_changed event. Equal instants, including repeated clears, return unchanged without writing.';

revoke all on function public.update_application_follow_up(uuid, timestamptz)
  from public;
revoke all on function public.update_application_follow_up(uuid, timestamptz)
  from anon;
grant execute on function public.update_application_follow_up(uuid, timestamptz)
  to authenticated;
