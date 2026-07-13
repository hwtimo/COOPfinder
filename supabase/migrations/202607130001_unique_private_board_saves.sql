-- Prevent one user from saving the same public board record more than once.
-- Manual jobs keep a null board_job_id and remain unrestricted.

do $$
begin
  if exists (
    select 1
    from public.job_postings
    where board_job_id is not null
    group by user_id, board_job_id
    having count(*) > 1
  ) then
    raise exception
      'Cannot enforce unique private board saves while duplicate user_id/board_job_id rows exist';
  end if;
end;
$$;

create unique index if not exists job_postings_user_board_job_unique_idx
  on public.job_postings(user_id, board_job_id)
  where board_job_id is not null;
