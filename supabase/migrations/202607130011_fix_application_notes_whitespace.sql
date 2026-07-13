-- Preserve the notes RPC contract while trimming all surrounding whitespace.

create or replace function public.update_application_notes(
  p_application_id uuid,
  p_notes text
) returns table (
  result_status text,
  application_id uuid,
  application_notes text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_notes text;
  v_previous_notes text;
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

  if p_notes is null then
    raise exception using
      errcode = '22023',
      message = 'notes must be text';
  end if;

  if pg_catalog.char_length(p_notes) > 5000 then
    raise exception using
      errcode = '22023',
      message = 'notes must be 5000 characters or fewer';
  end if;

  v_notes := nullif(
    pg_catalog.regexp_replace(
      p_notes,
      '^[[:space:]]+|[[:space:]]+$',
      '',
      'g'
    ),
    ''
  );

  select nullif(
    pg_catalog.regexp_replace(
      application.notes,
      '^[[:space:]]+|[[:space:]]+$',
      '',
      'g'
    ),
    ''
  )
  into v_previous_notes
  from public.applications as application
  where application.id = p_application_id
    and application.user_id = v_user_id
  for update;

  if not found then
    return query
    select 'unavailable'::text, null::uuid, null::text;
    return;
  end if;

  if v_previous_notes is not distinct from v_notes then
    return query
    select 'unchanged'::text, p_application_id, v_previous_notes;
    return;
  end if;

  v_event_at := pg_catalog.clock_timestamp();

  update public.applications as application
  set
    notes = v_notes,
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
    'Notes updated',
    'Application notes updated.',
    v_event_at::date,
    'note_updated',
    v_event_at,
    pg_catalog.jsonb_build_object(
      'had_notes', v_previous_notes is not null,
      'has_notes', v_notes is not null
    )
  );

  return query
  select 'updated'::text, p_application_id, v_notes;
end;
$$;

comment on function public.update_application_notes(uuid, text) is
  'Atomically stores surrounding-whitespace-normalized caller-owned application notes and appends one content-free note_updated event. Normalized no-op requests return unchanged without writing.';

revoke all on function public.update_application_notes(uuid, text) from public;
revoke all on function public.update_application_notes(uuid, text) from anon;
grant execute on function public.update_application_notes(uuid, text) to authenticated;
