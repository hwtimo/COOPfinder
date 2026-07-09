create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  school text check (school in ('SFU', 'UBC', 'Waterloo', 'Other')),
  program text,
  grad_year integer,
  coop_term text,
  work_authorization text check (
    work_authorization in (
      'Canadian work authorization',
      'Domestic students',
      'International eligible'
    )
  ),
  preferred_locations text[] not null default '{}',
  target_roles text[] not null default '{}',
  ai_training_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  website text,
  headquarters text,
  industry text,
  hiring_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index companies_name_lower_idx on public.companies (lower(name));

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  role_type text,
  location text,
  term text,
  work_mode text check (work_mode in ('Remote', 'Hybrid', 'On-site')),
  deadline date,
  source_url text,
  raw_text text,
  description text,
  extracted jsonb not null default '{}'::jsonb,
  match_score integer check (match_score between 0 and 100),
  status text not null default 'saved' check (
    status in (
      'saved',
      'tailoring',
      'ready',
      'applied',
      'oa',
      'interview',
      'offer',
      'rejected'
    )
  ),
  coop_eligible boolean not null default true,
  work_authorization text check (
    work_authorization in (
      'Canadian work authorization',
      'Domestic students',
      'International eligible'
    )
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_postings_user_id_idx on public.job_postings(user_id);
create index job_postings_company_id_idx on public.job_postings(company_id);
create index job_postings_deadline_idx on public.job_postings(deadline);
create index job_postings_status_idx on public.job_postings(status);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  status text not null default 'saved' check (
    status in (
      'saved',
      'tailoring',
      'ready',
      'applied',
      'oa',
      'interview',
      'offer',
      'rejected'
    )
  ),
  deadline date,
  applied_at date,
  follow_up_due date,
  last_action text,
  next_action text,
  notes text,
  sort_order real not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_posting_id)
);

create index applications_user_id_idx on public.applications(user_id);
create index applications_job_posting_id_idx on public.applications(job_posting_id);
create index applications_status_idx on public.applications(status);
create index applications_deadline_idx on public.applications(deadline);

create table public.application_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  label text not null,
  detail text,
  event_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index application_timeline_events_user_id_idx on public.application_timeline_events(user_id);
create index application_timeline_events_application_id_idx on public.application_timeline_events(application_id);

create table public.master_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  summary text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.master_profile_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  master_profile_id uuid not null references public.master_profiles(id) on delete cascade,
  section text not null check (
    section in (
      'education',
      'experience',
      'project',
      'skills',
      'certification',
      'volunteer'
    )
  ),
  source_label text,
  title text,
  organization text,
  entry_text text not null,
  skills text[] not null default '{}',
  impact text,
  confirmed boolean not null default false,
  sort_order real not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index master_profile_entries_user_id_idx on public.master_profile_entries(user_id);
create index master_profile_entries_master_profile_id_idx on public.master_profile_entries(master_profile_id);
create index master_profile_entries_section_idx on public.master_profile_entries(section);

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_posting_id uuid references public.job_postings(id) on delete set null,
  name text not null,
  focus text,
  base_version_name text,
  content jsonb not null default '{}'::jsonb,
  keyword_report jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resume_versions_user_id_idx on public.resume_versions(user_id);
create index resume_versions_job_posting_id_idx on public.resume_versions(job_posting_id);

create table public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,
  tailor_count integer not null default 0 check (tailor_count >= 0),
  job_save_count integer not null default 0 check (job_save_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger job_postings_set_updated_at
before update on public.job_postings
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create trigger application_timeline_events_set_updated_at
before update on public.application_timeline_events
for each row execute function public.set_updated_at();

create trigger master_profiles_set_updated_at
before update on public.master_profiles
for each row execute function public.set_updated_at();

create trigger master_profile_entries_set_updated_at
before update on public.master_profile_entries
for each row execute function public.set_updated_at();

create trigger resume_versions_set_updated_at
before update on public.resume_versions
for each row execute function public.set_updated_at();

create trigger usage_counters_set_updated_at
before update on public.usage_counters
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.job_postings enable row level security;
alter table public.applications enable row level security;
alter table public.application_timeline_events enable row level security;
alter table public.master_profiles enable row level security;
alter table public.master_profile_entries enable row level security;
alter table public.resume_versions enable row level security;
alter table public.usage_counters enable row level security;

create policy "profiles select own"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "profiles insert own"
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "profiles update own"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "profiles delete own"
on public.profiles
for delete
to authenticated
using (user_id = auth.uid());

create policy "companies select authenticated"
on public.companies
for select
to authenticated
using (true);

create policy "companies insert creator"
on public.companies
for insert
to authenticated
with check (created_by = auth.uid());

create policy "companies update creator"
on public.companies
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "companies delete creator"
on public.companies
for delete
to authenticated
using (created_by = auth.uid());

create policy "job_postings select own"
on public.job_postings
for select
to authenticated
using (user_id = auth.uid());

create policy "job_postings insert own"
on public.job_postings
for insert
to authenticated
with check (user_id = auth.uid());

create policy "job_postings update own"
on public.job_postings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "job_postings delete own"
on public.job_postings
for delete
to authenticated
using (user_id = auth.uid());

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
    from public.job_postings
    where job_postings.id = applications.job_posting_id
      and job_postings.user_id = auth.uid()
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
    from public.job_postings
    where job_postings.id = applications.job_posting_id
      and job_postings.user_id = auth.uid()
  )
);

create policy "applications delete own"
on public.applications
for delete
to authenticated
using (user_id = auth.uid());

create policy "application_timeline_events select own"
on public.application_timeline_events
for select
to authenticated
using (user_id = auth.uid());

create policy "application_timeline_events insert own"
on public.application_timeline_events
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.applications
    where applications.id = application_timeline_events.application_id
      and applications.user_id = auth.uid()
  )
);

create policy "application_timeline_events update own"
on public.application_timeline_events
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.applications
    where applications.id = application_timeline_events.application_id
      and applications.user_id = auth.uid()
  )
);

create policy "application_timeline_events delete own"
on public.application_timeline_events
for delete
to authenticated
using (user_id = auth.uid());

create policy "master_profiles select own"
on public.master_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "master_profiles insert own"
on public.master_profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "master_profiles update own"
on public.master_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "master_profiles delete own"
on public.master_profiles
for delete
to authenticated
using (user_id = auth.uid());

create policy "master_profile_entries select own"
on public.master_profile_entries
for select
to authenticated
using (user_id = auth.uid());

create policy "master_profile_entries insert own"
on public.master_profile_entries
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.master_profiles
    where master_profiles.id = master_profile_entries.master_profile_id
      and master_profiles.user_id = auth.uid()
  )
);

create policy "master_profile_entries update own"
on public.master_profile_entries
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.master_profiles
    where master_profiles.id = master_profile_entries.master_profile_id
      and master_profiles.user_id = auth.uid()
  )
);

create policy "master_profile_entries delete own"
on public.master_profile_entries
for delete
to authenticated
using (user_id = auth.uid());

create policy "resume_versions select own"
on public.resume_versions
for select
to authenticated
using (user_id = auth.uid());

create policy "resume_versions insert own"
on public.resume_versions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    job_posting_id is null
    or exists (
      select 1
      from public.job_postings
      where job_postings.id = resume_versions.job_posting_id
        and job_postings.user_id = auth.uid()
    )
  )
);

create policy "resume_versions update own"
on public.resume_versions
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    job_posting_id is null
    or exists (
      select 1
      from public.job_postings
      where job_postings.id = resume_versions.job_posting_id
        and job_postings.user_id = auth.uid()
    )
  )
);

create policy "resume_versions delete own"
on public.resume_versions
for delete
to authenticated
using (user_id = auth.uid());

create policy "usage_counters select own"
on public.usage_counters
for select
to authenticated
using (user_id = auth.uid());
