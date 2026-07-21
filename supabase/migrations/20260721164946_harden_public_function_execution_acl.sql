-- Remove direct execution grants supplied by legacy public-schema defaults.

revoke all on function public.submit_board_job(
  text, text, text, text, text, date, text, text
) from public;
revoke all on function public.submit_board_job(
  text, text, text, text, text, date, text, text
) from anon;
revoke all on function public.submit_board_job(
  text, text, text, text, text, date, text, text
) from authenticated;
revoke all on function public.submit_board_job(
  text, text, text, text, text, date, text, text
) from service_role;

revoke all on function public.submit_board_job_with_private_copy(
  text, text, text, text, text, text, date, text[], text, text
) from public;
revoke all on function public.submit_board_job_with_private_copy(
  text, text, text, text, text, text, date, text[], text, text
) from anon;
revoke all on function public.submit_board_job_with_private_copy(
  text, text, text, text, text, text, date, text[], text, text
) from authenticated;
revoke all on function public.submit_board_job_with_private_copy(
  text, text, text, text, text, text, date, text[], text, text
) from service_role;
grant execute on function public.submit_board_job_with_private_copy(
  text, text, text, text, text, text, date, text[], text, text
) to authenticated;

revoke all on function public.tailoring_credit_balance(uuid) from public;
revoke all on function public.tailoring_credit_balance(uuid) from anon;
revoke all on function public.tailoring_credit_balance(uuid) from authenticated;
revoke all on function public.tailoring_credit_balance(uuid) from service_role;
grant execute on function public.tailoring_credit_balance(uuid)
  to authenticated, service_role;
