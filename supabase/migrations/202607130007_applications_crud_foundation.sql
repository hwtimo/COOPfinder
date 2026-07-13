-- Harden the existing application tracker tables for persisted MVP CRUD.

do $$
begin
  if exists (
    select 1
    from public.applications a
    where a.status not in (
      'saved', 'tailoring', 'ready', 'applied',
      'interview', 'offer', 'rejected'
    )
  ) then
    raise exception
      'applications contains non-canonical statuses; resolve them before applying migration 202607130007';
  end if;

  if exists (
    select 1
    from public.applications a
    left join public.job_postings j
      on j.id = a.job_posting_id
     and j.user_id = a.user_id
    where j.id is null
  ) then
    raise exception
      'applications contains a job ownership mismatch; resolve it before applying migration 202607130007';
  end if;

  if exists (
    select 1
    from public.application_timeline_events e
    left join public.applications a
      on a.id = e.application_id
     and a.user_id = e.user_id
    where a.id is null
  ) then
    raise exception
      'application timeline contains an ownership mismatch; resolve it before applying migration 202607130007';
  end if;
end;
$$;

alter table public.applications
  drop constraint if exists applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (
    status in (
      'saved', 'tailoring', 'ready', 'applied',
      'interview', 'offer', 'rejected'
    )
  ) not valid;

alter table public.applications
  validate constraint applications_status_check;

alter table public.applications
  alter column applied_at type timestamptz
    using (
      case
        when applied_at is null then null
        else applied_at::timestamp at time zone 'UTC'
      end
    ),
  alter column follow_up_due type timestamptz
    using (
      case
        when follow_up_due is null then null
        else follow_up_due::timestamp at time zone 'UTC'
      end
    );

alter table public.application_timeline_events
  add column event_type text,
  add column event_at timestamptz,
  add column metadata jsonb not null default '{}'::jsonb;

update public.application_timeline_events
set
  event_type = 'activity',
  event_at = case
    when event_date is not null
      then event_date::timestamp at time zone 'UTC'
    else created_at
  end;

alter table public.application_timeline_events
  alter column event_type set default 'activity',
  alter column event_type set not null,
  alter column event_at set default now(),
  alter column event_at set not null;

alter table public.application_timeline_events
  add constraint application_timeline_events_event_type_check
  check (
    event_type in (
      'application_created',
      'status_changed',
      'note_updated',
      'deadline_changed',
      'follow_up_changed',
      'marked_applied',
      'activity'
    )
  ) not valid,
  add constraint application_timeline_events_metadata_object_check
  check (jsonb_typeof(metadata) = 'object') not valid;

alter table public.application_timeline_events
  validate constraint application_timeline_events_event_type_check;

alter table public.application_timeline_events
  validate constraint application_timeline_events_metadata_object_check;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.job_postings'::regclass
      and conname = 'job_postings_id_user_id_key'
  ) then
    alter table public.job_postings
      add constraint job_postings_id_user_id_key unique (id, user_id);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_id_user_id_key'
  ) then
    alter table public.applications
      add constraint applications_id_user_id_key unique (id, user_id);
  end if;
end;
$$;

alter table public.applications
  add constraint applications_job_owner_fkey
  foreign key (job_posting_id, user_id)
  references public.job_postings(id, user_id)
  on delete restrict
  not valid;

alter table public.applications
  validate constraint applications_job_owner_fkey;

alter table public.applications
  drop constraint if exists applications_job_posting_id_fkey;

alter table public.application_timeline_events
  add constraint application_timeline_events_application_owner_fkey
  foreign key (application_id, user_id)
  references public.applications(id, user_id)
  on delete cascade
  not valid;

alter table public.application_timeline_events
  validate constraint application_timeline_events_application_owner_fkey;

alter table public.application_timeline_events
  drop constraint if exists application_timeline_events_application_id_fkey;

create index if not exists applications_user_status_sort_idx
  on public.applications(user_id, status, sort_order);

create index if not exists applications_user_follow_up_due_idx
  on public.applications(user_id, follow_up_due)
  where follow_up_due is not null;

create index if not exists application_timeline_events_application_event_at_idx
  on public.application_timeline_events(application_id, event_at, id);

alter table public.applications enable row level security;
alter table public.application_timeline_events enable row level security;

drop policy if exists "applications select own" on public.applications;
drop policy if exists "applications insert own" on public.applications;
drop policy if exists "applications update own" on public.applications;
drop policy if exists "applications delete own" on public.applications;

create policy "applications select own"
on public.applications
for select
to authenticated
using (user_id = auth.uid());

create policy "applications insert own"
on public.applications
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.job_postings j
    where j.id = applications.job_posting_id
      and j.user_id = auth.uid()
  )
);

create policy "applications update own"
on public.applications
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.job_postings j
    where j.id = applications.job_posting_id
      and j.user_id = auth.uid()
  )
);

create policy "applications delete own"
on public.applications
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "application_timeline_events select own"
  on public.application_timeline_events;
drop policy if exists "application_timeline_events insert own"
  on public.application_timeline_events;
drop policy if exists "application_timeline_events update own"
  on public.application_timeline_events;
drop policy if exists "application_timeline_events delete own"
  on public.application_timeline_events;

create policy "application_timeline_events select own"
on public.application_timeline_events
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.applications a
    where a.id = application_timeline_events.application_id
      and a.user_id = auth.uid()
  )
);

create policy "application_timeline_events insert own"
on public.application_timeline_events
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.applications a
    where a.id = application_timeline_events.application_id
      and a.user_id = auth.uid()
  )
);

revoke all on table public.applications from public, anon;
revoke all on table public.application_timeline_events from public, anon;

grant select, insert, update, delete
  on table public.applications to authenticated;
grant select, insert
  on table public.application_timeline_events to authenticated;
