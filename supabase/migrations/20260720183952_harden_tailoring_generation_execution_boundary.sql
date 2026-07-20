revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from public;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from anon;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from authenticated;
revoke all on function public.reserve_tailoring_generation_credit(uuid, uuid, text, text, text) from service_role;

revoke all on function public.refund_tailoring_generation_reservation(uuid) from public;
revoke all on function public.refund_tailoring_generation_reservation(uuid) from anon;
revoke all on function public.refund_tailoring_generation_reservation(uuid) from authenticated;
revoke all on function public.refund_tailoring_generation_reservation(uuid) from service_role;

revoke all on function public.finalize_tailoring_generation(uuid, text, text, text, jsonb) from public;
revoke all on function public.finalize_tailoring_generation(uuid, text, text, text, jsonb) from anon;
revoke all on function public.finalize_tailoring_generation(uuid, text, text, text, jsonb) from authenticated;
revoke all on function public.finalize_tailoring_generation(uuid, text, text, text, jsonb) from service_role;

create function public.reserve_tailoring_generation_credit_trusted(
  p_user_id uuid,
  p_job_posting_id uuid,
  p_idempotency_key uuid,
  p_input_fingerprint text,
  p_provider_input_contract_version text,
  p_provider_output_contract_version text
) returns table (
  result_status text,
  reservation_id uuid,
  resume_version_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return query select 'invalid_input'::text, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );

  return query
  select *
  from public.reserve_tailoring_generation_credit(
    p_job_posting_id,
    p_idempotency_key,
    p_input_fingerprint,
    p_provider_input_contract_version,
    p_provider_output_contract_version
  );
end;
$$;

revoke all on function public.reserve_tailoring_generation_credit_trusted(uuid, uuid, uuid, text, text, text) from public;
revoke all on function public.reserve_tailoring_generation_credit_trusted(uuid, uuid, uuid, text, text, text) from anon;
revoke all on function public.reserve_tailoring_generation_credit_trusted(uuid, uuid, uuid, text, text, text) from authenticated;
grant execute on function public.reserve_tailoring_generation_credit_trusted(uuid, uuid, uuid, text, text, text) to service_role;

create function public.refund_tailoring_generation_reservation_trusted(
  p_user_id uuid,
  p_reservation_id uuid
) returns table (
  result_status text,
  reservation_id uuid,
  resume_version_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return query select 'invalid_input'::text, null::uuid, null::uuid;
    return;
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );

  return query
  select *
  from public.refund_tailoring_generation_reservation(p_reservation_id);
end;
$$;

revoke all on function public.refund_tailoring_generation_reservation_trusted(uuid, uuid) from public;
revoke all on function public.refund_tailoring_generation_reservation_trusted(uuid, uuid) from anon;
revoke all on function public.refund_tailoring_generation_reservation_trusted(uuid, uuid) from authenticated;
grant execute on function public.refund_tailoring_generation_reservation_trusted(uuid, uuid) to service_role;

create function public.finalize_tailoring_generation_trusted(
  p_user_id uuid,
  p_reservation_id uuid,
  p_input_fingerprint text,
  p_provider_input_contract_version text,
  p_provider_output_contract_version text,
  p_plan jsonb
) returns table (
  result_status text,
  reservation_id uuid,
  resume_version_id uuid,
  version_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return query select 'invalid_input'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );

  return query
  select *
  from public.finalize_tailoring_generation(
    p_reservation_id,
    p_input_fingerprint,
    p_provider_input_contract_version,
    p_provider_output_contract_version,
    p_plan
  );
end;
$$;

revoke all on function public.finalize_tailoring_generation_trusted(uuid, uuid, text, text, text, jsonb) from public;
revoke all on function public.finalize_tailoring_generation_trusted(uuid, uuid, text, text, text, jsonb) from anon;
revoke all on function public.finalize_tailoring_generation_trusted(uuid, uuid, text, text, text, jsonb) from authenticated;
grant execute on function public.finalize_tailoring_generation_trusted(uuid, uuid, text, text, text, jsonb) to service_role;
