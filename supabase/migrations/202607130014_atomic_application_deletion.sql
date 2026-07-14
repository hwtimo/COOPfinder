-- Atomically delete one caller-owned application and its cascaded timeline.

create or replace function public.delete_application(
  p_application_id uuid
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

  select application.id
  into v_application_id
  from public.applications as application
  where application.id = p_application_id
    and application.user_id = v_user_id
  for update;

  if not found then
    return query select 'unavailable'::text, null::uuid;
    return;
  end if;

  delete from public.applications as application
  where application.id = v_application_id
    and application.user_id = v_user_id;

  return query select 'deleted'::text, v_application_id;
end;
$$;

comment on function public.delete_application(uuid) is
  'Deletes one caller-owned application and its cascaded timeline. The linked private saved job and unrelated records remain unchanged.';

revoke all on function public.delete_application(uuid) from public;
revoke all on function public.delete_application(uuid) from anon;
grant execute on function public.delete_application(uuid) to authenticated;
