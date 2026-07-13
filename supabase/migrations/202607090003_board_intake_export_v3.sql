-- Schema Delta v3: public board moderation and job intake foundation.

do $$
begin
  if to_regclass('public.board_jobs') is null then
    if to_regclass('public.catalog_jobs') is not null then
      alter table public.catalog_jobs rename to board_jobs;
    else
      raise exception 'Expected public.catalog_jobs or public.board_jobs to exist before applying board intake v3 migration';
    end if;
  end if;
end;
$$;

alter table public.board_jobs
  add column if not exists status text,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists submitted_url text,
  add column if not exists submission_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

update public.board_jobs
set status = 'approved'
where status is null;

alter table public.board_jobs
  alter column status set default 'approved';

alter table public.board_jobs
  drop constraint if exists board_jobs_status_check;

alter table public.board_jobs
  add constraint board_jobs_status_check
  check (status in ('pending_review','approved','rejected','archived'))
  not valid;

alter table public.board_jobs validate constraint board_jobs_status_check;

alter table public.board_jobs
  alter column status set not null;

comment on table public.board_jobs is
  'Moderated public starter board jobs. Summaries are written in-house; no scraped posting text is stored.';

comment on column public.board_jobs.summary is
  'Short in-house summary only. Do not paste or scrape employer job descriptions into this field.';

comment on column public.board_jobs.source_url is
  'Public link-out source for approved board jobs.';

comment on column public.board_jobs.submitted_url is
  'User-submitted source URL captured for review. Public visibility still depends on status, is_active, and deadline.';

drop trigger if exists catalog_jobs_set_updated_at on public.board_jobs;
drop trigger if exists board_jobs_set_updated_at on public.board_jobs;

create trigger board_jobs_set_updated_at
before update on public.board_jobs
for each row execute function public.set_updated_at();

alter table public.board_jobs enable row level security;

drop policy if exists "catalog_jobs select active" on public.board_jobs;
drop policy if exists "board_jobs select public approved" on public.board_jobs;
drop policy if exists "board_jobs select own submissions" on public.board_jobs;

create policy "board_jobs select public approved"
on public.board_jobs
for select
to anon, authenticated
using (
  status = 'approved'
  and is_active = true
  and (deadline is null or deadline >= current_date)
);

create policy "board_jobs select own submissions"
on public.board_jobs
for select
to authenticated
using (submitted_by = auth.uid());

create index if not exists board_jobs_public_read_idx
  on public.board_jobs(status, is_active, deadline);

create index if not exists board_jobs_submitted_by_idx
  on public.board_jobs(submitted_by);

create index if not exists board_jobs_source_url_idx
  on public.board_jobs(source_url);

create or replace function public.submit_board_job(
  p_title text,
  p_company_name text,
  p_location text,
  p_term text,
  p_work_mode text,
  p_deadline date,
  p_source_url text,
  p_note text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.board_jobs (
    title,
    company_name,
    location,
    term,
    work_mode,
    deadline,
    source_url,
    summary,
    status,
    submitted_by,
    submitted_url,
    submission_note,
    is_active
  ) values (
    p_title,
    p_company_name,
    p_location,
    p_term,
    p_work_mode,
    p_deadline,
    p_source_url,
    '',
    'pending_review',
    auth.uid(),
    p_source_url,
    p_note,
    false
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_board_job(text, text, text, text, text, date, text, text) from public;
grant execute on function public.submit_board_job(text, text, text, text, text, date, text, text) to authenticated;

create table if not exists public.job_intake_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_type text not null check (input_type in ('url','text')),
  url text,
  outcome text not null check (
    outcome in ('extracted','fallback_manual','fetch_blocked','failed')
  ),
  overall_confidence numeric(3,2) check (
    overall_confidence is null
    or (overall_confidence >= 0 and overall_confidence <= 1)
  ),
  model_tier text,
  job_posting_id uuid references public.job_postings(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists job_intake_events_user_idx
  on public.job_intake_events(user_id);

create index if not exists job_intake_events_job_posting_idx
  on public.job_intake_events(job_posting_id);

create index if not exists job_intake_events_created_at_idx
  on public.job_intake_events(created_at);

alter table public.job_intake_events enable row level security;

drop policy if exists "intake events select own" on public.job_intake_events;

create policy "intake events select own"
on public.job_intake_events
for select
to authenticated
using (user_id = auth.uid());

alter table public.job_postings
  add column if not exists intake_source text,
  add column if not exists extraction_confidence numeric(3,2),
  add column if not exists board_job_id uuid references public.board_jobs(id) on delete set null;

update public.job_postings
set intake_source = 'manual'
where intake_source is null;

alter table public.job_postings
  alter column intake_source set default 'manual';

alter table public.job_postings
  drop constraint if exists job_postings_intake_source_check;

alter table public.job_postings
  add constraint job_postings_intake_source_check
  check (intake_source in ('pasted_url','pasted_text','board_save','manual'))
  not valid;

alter table public.job_postings validate constraint job_postings_intake_source_check;

alter table public.job_postings
  alter column intake_source set not null;

alter table public.job_postings
  drop constraint if exists job_postings_extraction_confidence_check;

alter table public.job_postings
  add constraint job_postings_extraction_confidence_check
  check (
    extraction_confidence is null
    or (extraction_confidence >= 0 and extraction_confidence <= 1)
  )
  not valid;

alter table public.job_postings validate constraint job_postings_extraction_confidence_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_postings'::regclass
      and conname = 'job_postings_board_job_id_fkey'
  ) then
    alter table public.job_postings
      add constraint job_postings_board_job_id_fkey
      foreign key (board_job_id) references public.board_jobs(id) on delete set null;
  end if;
end;
$$;

create index if not exists job_postings_board_job_id_idx
  on public.job_postings(board_job_id);

create index if not exists job_postings_intake_source_idx
  on public.job_postings(intake_source);

alter table public.profiles
  add column if not exists is_admin boolean not null default false;
