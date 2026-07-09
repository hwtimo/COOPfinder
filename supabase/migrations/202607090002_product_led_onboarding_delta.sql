-- Product-led onboarding schema delta:
-- starter catalog for guest matching and server-written tailoring credits.

create table public.catalog_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company_name text not null,
  location text,
  work_mode text check (work_mode in ('Remote', 'Hybrid', 'On-site')),
  term text,
  deadline date,
  work_authorization text,
  summary text not null,
  required_skills text[] not null default '{}',
  nice_to_have_skills text[] not null default '{}',
  keywords text[] not null default '{}',
  source_url text not null,
  is_active boolean not null default true,
  last_checked_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.catalog_jobs is
  'Hand-entered starter catalog jobs for public guest matching. Summaries are written in-house; no scraped posting text is stored.';

comment on column public.catalog_jobs.summary is
  'Short in-house summary only. Do not paste or scrape employer job descriptions into this field.';

comment on column public.catalog_jobs.source_url is
  'Link-out source for the starter catalog role.';

create index catalog_jobs_active_idx on public.catalog_jobs(is_active);
create index catalog_jobs_location_idx on public.catalog_jobs(location);
create index catalog_jobs_deadline_idx on public.catalog_jobs(deadline);
create index catalog_jobs_work_mode_idx on public.catalog_jobs(work_mode);

create trigger catalog_jobs_set_updated_at
before update on public.catalog_jobs
for each row execute function public.set_updated_at();

alter table public.catalog_jobs enable row level security;

create policy "catalog_jobs select active"
on public.catalog_jobs
for select
to anon, authenticated
using (is_active = true);

insert into public.catalog_jobs (
  title,
  company_name,
  location,
  work_mode,
  term,
  deadline,
  work_authorization,
  summary,
  required_skills,
  nice_to_have_skills,
  keywords,
  source_url,
  is_active,
  last_checked_at
) values
  (
    'Software Engineering Co-op',
    'TELUS',
    'Vancouver, BC',
    'Hybrid',
    'Fall 2026 · 4 months',
    '2026-07-24',
    'International eligible',
    'In-house summary: student software role focused on web features, APIs, testing, and collaboration with product teams.',
    array['TypeScript', 'React', 'REST APIs', 'Git'],
    array['Cloud services', 'Unit testing', 'Agile'],
    array['software', 'frontend', 'api', 'testing', 'co-op'],
    'https://careers.telus.com/',
    true,
    '2026-07-09'
  ),
  (
    'Embedded Software Co-op',
    'D-Wave',
    'Burnaby, BC',
    'Hybrid',
    'Fall 2026 · 8 months',
    '2026-07-26',
    'Canadian work authorization',
    'In-house summary: embedded student role for hardware-adjacent debugging, control software, and test automation.',
    array['C++', 'Python', 'Linux', 'Debugging'],
    array['Embedded systems', 'Test automation', 'Hardware bring-up'],
    array['embedded', 'c++', 'linux', 'qa', 'co-op'],
    'https://www.dwavequantum.com/company/careers/',
    true,
    '2026-07-09'
  ),
  (
    'Data Analyst Intern',
    'RBC',
    'Toronto, ON',
    'Hybrid',
    'Winter 2027 · 4 months',
    '2026-08-02',
    'Domestic students',
    'In-house summary: analytics internship supporting dashboards, product reporting, and business-facing data requests.',
    array['SQL', 'Excel', 'Python', 'Data visualization'],
    array['Tableau', 'Power BI', 'Stakeholder communication'],
    array['data', 'analytics', 'sql', 'dashboard', 'intern'],
    'https://jobs.rbc.com/ca/en/students-graduates',
    true,
    '2026-07-09'
  ),
  (
    'Embedded Systems Co-op',
    'BlackBerry QNX',
    'Waterloo, ON',
    'On-site',
    'Fall 2026 · 8 months',
    '2026-07-31',
    'Canadian work authorization',
    'In-house summary: systems co-op role centered on real-time software, C/C++ debugging, and validation work.',
    array['C', 'C++', 'Operating systems', 'Debugging'],
    array['Real-time systems', 'Python', 'Validation'],
    array['embedded', 'systems', 'rtos', 'c++', 'co-op'],
    'https://blackberry.qnx.com/en/careers',
    true,
    '2026-07-09'
  ),
  (
    'Data Analyst Co-op',
    'BC Hydro',
    'Burnaby, BC',
    'Hybrid',
    'Fall 2026 · 4 months',
    '2026-08-05',
    'International eligible',
    'In-house summary: operations analytics role supporting reporting, data quality checks, and spreadsheet workflows.',
    array['SQL', 'Excel', 'Data cleaning', 'Reporting'],
    array['Power BI', 'Python', 'Process documentation'],
    array['data', 'analyst', 'utilities', 'reporting', 'co-op'],
    'https://www.bchydro.com/about/careers.html',
    true,
    '2026-07-09'
  ),
  (
    'Software Developer Co-op',
    'Hootsuite',
    'Vancouver, BC',
    'Hybrid',
    'Fall 2026 · 8 months',
    '2026-08-08',
    'International eligible',
    'In-house summary: product engineering co-op role contributing web features, bug fixes, and team code reviews.',
    array['JavaScript', 'React', 'APIs', 'Git'],
    array['TypeScript', 'Testing', 'Product analytics'],
    array['software', 'frontend', 'product', 'co-op'],
    'https://careers.hootsuite.com/',
    true,
    '2026-07-09'
  ),
  (
    'Software Developer Intern',
    'Shopify',
    'Toronto, ON',
    'Remote',
    'Winter 2027 · 4 months',
    '2026-08-15',
    'International eligible',
    'In-house summary: software internship for building merchant-facing tools, reviewing code, and improving product workflows.',
    array['Ruby', 'JavaScript', 'Web development', 'Testing'],
    array['React', 'GraphQL', 'Product thinking'],
    array['software', 'full-stack', 'commerce', 'intern'],
    'https://www.shopify.com/careers',
    true,
    '2026-07-09'
  ),
  (
    'Cloud Platform Co-op',
    'SAP',
    'Vancouver, BC',
    'Hybrid',
    'Fall 2026 · 4 months',
    '2026-08-09',
    'International eligible',
    'In-house summary: platform co-op role helping with cloud services, monitoring, and internal developer tooling.',
    array['Java', 'Cloud services', 'Linux', 'Git'],
    array['Kubernetes', 'Observability', 'CI/CD'],
    array['cloud', 'platform', 'devtools', 'co-op'],
    'https://jobs.sap.com/',
    true,
    '2026-07-09'
  ),
  (
    'Full Stack Developer Co-op',
    'Clio',
    'Burnaby, BC',
    'Hybrid',
    'Fall 2026 · 8 months',
    '2026-08-01',
    'International eligible',
    'In-house summary: full-stack co-op role supporting legal technology features across backend, frontend, and product analytics.',
    array['Ruby on Rails', 'React', 'SQL', 'Git'],
    array['TypeScript', 'Product analytics', 'Testing'],
    array['full-stack', 'rails', 'react', 'co-op'],
    'https://www.clio.com/about/careers/',
    true,
    '2026-07-09'
  ),
  (
    'Network Software Co-op',
    'Nokia',
    'Waterloo, ON',
    'On-site',
    'Winter 2027 · 8 months',
    '2026-08-19',
    'Canadian work authorization',
    'In-house summary: network software role focused on telecom systems, automated tests, and systems programming fundamentals.',
    array['C++', 'Networking', 'Linux', 'Testing'],
    array['Python', 'Distributed systems', 'Scripting'],
    array['network', 'systems', 'telecom', 'co-op'],
    'https://www.nokia.com/about-us/careers/',
    true,
    '2026-07-09'
  ),
  (
    'Software Engineering Co-op',
    'Northstar Robotics',
    'Vancouver, BC',
    'Hybrid',
    'Summer 2027 · 4 months',
    '2026-08-12',
    'International eligible',
    'In-house summary: robotics software role for fleet monitoring tools, API integrations, and careful debugging.',
    array['TypeScript', 'React', 'REST APIs', 'Debugging'],
    array['Robotics', 'Maps', 'Telemetry'],
    array['software', 'robotics', 'frontend', 'co-op'],
    'https://northstarrobotics.ca/careers',
    true,
    '2026-07-09'
  ),
  (
    'Cloud Support Intern',
    'Amazon Web Services',
    'Vancouver, BC',
    'Hybrid',
    'Winter 2027 · 4 months',
    '2026-08-21',
    'International eligible',
    'In-house summary: cloud internship focused on troubleshooting, documentation, scripting, and customer-facing technical support.',
    array['Cloud fundamentals', 'Linux', 'Networking', 'Python'],
    array['AWS', 'Technical writing', 'Customer support'],
    array['cloud', 'support', 'linux', 'intern'],
    'https://www.amazon.jobs/',
    true,
    '2026-07-09'
  ),
  (
    'Software Engineer Intern',
    'Microsoft',
    'Vancouver, BC',
    'Hybrid',
    'Summer 2027 · 4 months',
    '2026-09-02',
    'International eligible',
    'In-house summary: software internship for implementing product features, writing tests, and learning large-team engineering practices.',
    array['C#', 'TypeScript', 'Data structures', 'Testing'],
    array['Azure', 'Accessibility', 'Distributed systems'],
    array['software', 'intern', 'cloud', 'testing'],
    'https://careers.microsoft.com/',
    true,
    '2026-07-09'
  ),
  (
    'QA Automation Co-op',
    'Electronic Arts',
    'Vancouver, BC',
    'Hybrid',
    'Fall 2026 · 4 months',
    '2026-07-29',
    'International eligible',
    'In-house summary: QA automation role building test scripts, investigating defects, and supporting game service quality.',
    array['Python', 'Test automation', 'Bug tracking', 'Git'],
    array['Game systems', 'JavaScript', 'CI/CD'],
    array['qa', 'automation', 'testing', 'co-op'],
    'https://www.ea.com/careers',
    true,
    '2026-07-09'
  ),
  (
    'Software QA Co-op',
    'Fortinet',
    'Burnaby, BC',
    'On-site',
    'Fall 2026 · 8 months',
    '2026-08-04',
    'Canadian work authorization',
    'In-house summary: security software QA role focused on test plans, network scenarios, and defect reproduction.',
    array['Networking', 'Linux', 'Python', 'Testing'],
    array['Cybersecurity', 'Automation', 'Virtualization'],
    array['qa', 'security', 'networking', 'co-op'],
    'https://www.fortinet.com/corporate/careers',
    true,
    '2026-07-09'
  ),
  (
    'Platform Software Co-op',
    'Arista Networks',
    'Vancouver, BC',
    'On-site',
    'Winter 2027 · 8 months',
    '2026-08-27',
    'Canadian work authorization',
    'In-house summary: platform software role for network systems, Linux tooling, and hardware-adjacent diagnostics.',
    array['C++', 'Linux', 'Networking', 'Debugging'],
    array['Python', 'Embedded systems', 'Switching'],
    array['platform', 'networking', 'systems', 'co-op'],
    'https://www.arista.com/en/careers',
    true,
    '2026-07-09'
  ),
  (
    'People Analytics Intern',
    'lululemon',
    'Vancouver, BC',
    'Hybrid',
    'Fall 2026 · 4 months',
    '2026-08-13',
    'International eligible',
    'In-house summary: analytics internship supporting dashboards, survey data, and business reporting for people operations.',
    array['Excel', 'SQL', 'Data visualization', 'Communication'],
    array['Power BI', 'Statistics', 'Data storytelling'],
    array['analyst', 'data', 'dashboard', 'intern'],
    'https://careers.lululemon.com/',
    true,
    '2026-07-09'
  ),
  (
    'Digital Systems Co-op',
    'Teck',
    'Vancouver, BC',
    'Hybrid',
    'Fall 2026 · 8 months',
    '2026-08-18',
    'International eligible',
    'In-house summary: digital systems role supporting operational tools, data cleanup, and internal workflow improvements.',
    array['SQL', 'Python', 'Process mapping', 'Excel'],
    array['Power Platform', 'APIs', 'Mining operations'],
    array['systems', 'analyst', 'data', 'co-op'],
    'https://www.teck.com/careers/',
    true,
    '2026-07-09'
  ),
  (
    'Data Analyst Co-op',
    'GeoComply',
    'Vancouver, BC',
    'Hybrid',
    'Winter 2027 · 4 months',
    '2026-08-25',
    'International eligible',
    'In-house summary: data co-op role analyzing product signals, checking data quality, and preparing concise findings.',
    array['SQL', 'Python', 'Data cleaning', 'Analytics'],
    array['Fraud signals', 'Dashboards', 'Statistics'],
    array['data', 'analyst', 'product', 'co-op'],
    'https://www.geocomply.com/careers/',
    true,
    '2026-07-09'
  ),
  (
    'Full Stack Co-op',
    'Semios',
    'Vancouver, BC',
    'Hybrid',
    'Summer 2027 · 4 months',
    '2026-09-01',
    'International eligible',
    'In-house summary: agtech full-stack role for web interfaces, APIs, and data-heavy user workflows.',
    array['TypeScript', 'React', 'Node.js', 'SQL'],
    array['Maps', 'IoT data', 'Testing'],
    array['full-stack', 'agtech', 'api', 'co-op'],
    'https://semios.com/careers/',
    true,
    '2026-07-09'
  ),
  (
    'Software Developer Co-op',
    'Jane App',
    'Remote, Canada',
    'Remote',
    'Fall 2026 · 4 months',
    '2026-08-16',
    'International eligible',
    'In-house summary: remote product engineering role contributing healthcare workflow features and small improvements across the stack.',
    array['Ruby on Rails', 'JavaScript', 'SQL', 'Git'],
    array['React', 'Accessibility', 'Product support'],
    array['software', 'remote', 'full-stack', 'co-op'],
    'https://jane.app/careers',
    true,
    '2026-07-09'
  ),
  (
    'Supply Chain Data Intern',
    'Kinaxis',
    'Toronto, ON',
    'Hybrid',
    'Winter 2027 · 4 months',
    '2026-08-28',
    'International eligible',
    'In-house summary: data internship supporting supply chain analytics, dashboard upkeep, and operations-focused insights.',
    array['SQL', 'Excel', 'Analytics', 'Communication'],
    array['Python', 'Supply chain', 'Power BI'],
    array['data', 'analyst', 'supply-chain', 'intern'],
    'https://www.kinaxis.com/en/careers',
    true,
    '2026-07-09'
  ),
  (
    'Software Developer Co-op',
    'Intuit',
    'Toronto, ON',
    'Hybrid',
    'Summer 2027 · 4 months',
    '2026-09-05',
    'International eligible',
    'In-house summary: software co-op role building financial product features, tests, and service integrations.',
    array['Java', 'React', 'APIs', 'Testing'],
    array['Kotlin', 'Cloud services', 'Fintech'],
    array['software', 'fintech', 'api', 'co-op'],
    'https://www.intuit.com/careers/',
    true,
    '2026-07-09'
  ),
  (
    'Backend Platform Intern',
    'Wealthsimple',
    'Toronto, ON',
    'Remote',
    'Fall 2026 · 4 months',
    '2026-08-22',
    'International eligible',
    'In-house summary: backend internship focused on services, reliability, and financial product infrastructure.',
    array['Ruby', 'APIs', 'SQL', 'Testing'],
    array['Kubernetes', 'Observability', 'Fintech'],
    array['backend', 'platform', 'fintech', 'intern'],
    'https://www.wealthsimple.com/en-ca/careers',
    true,
    '2026-07-09'
  ),
  (
    'Cloud Software Developer Co-op',
    'OpenText',
    'Waterloo, ON',
    'Hybrid',
    'Fall 2026 · 8 months',
    '2026-08-26',
    'Canadian work authorization',
    'In-house summary: cloud software role supporting enterprise services, automated tests, and deployment workflows.',
    array['Java', 'Cloud services', 'Linux', 'Testing'],
    array['Docker', 'CI/CD', 'Security'],
    array['cloud', 'software', 'enterprise', 'co-op'],
    'https://careers.opentext.com/',
    true,
    '2026-07-09'
  ),
  (
    'QA Automation Co-op',
    'Magnet Forensics',
    'Waterloo, ON',
    'Hybrid',
    'Winter 2027 · 8 months',
    '2026-08-30',
    'Canadian work authorization',
    'In-house summary: QA automation role for digital investigation software, regression tests, and release quality workflows.',
    array['Python', 'Test automation', 'Windows', 'Bug tracking'],
    array['C#', 'Security', 'Forensics tools'],
    array['qa', 'automation', 'security', 'co-op'],
    'https://www.magnetforensics.com/careers/',
    true,
    '2026-07-09'
  ),
  (
    'Software Engineering Co-op',
    'AMD',
    'Toronto, ON',
    'Hybrid',
    'Winter 2027 · 8 months',
    '2026-09-03',
    'Canadian work authorization',
    'In-house summary: software role supporting performance tools, validation workflows, and hardware-adjacent engineering tasks.',
    array['C++', 'Python', 'Linux', 'Debugging'],
    array['GPU fundamentals', 'Performance testing', 'Automation'],
    array['software', 'hardware', 'validation', 'co-op'],
    'https://www.amd.com/en/corporate/careers.html',
    true,
    '2026-07-09'
  ),
  (
    'Platform Engineering Intern',
    'League',
    'Toronto, ON',
    'Hybrid',
    'Fall 2026 · 4 months',
    '2026-08-17',
    'International eligible',
    'In-house summary: platform internship contributing service integrations, internal tooling, and reliability improvements.',
    array['TypeScript', 'Node.js', 'APIs', 'SQL'],
    array['Cloud services', 'Observability', 'Healthcare systems'],
    array['platform', 'backend', 'api', 'intern'],
    'https://league.com/careers/',
    true,
    '2026-07-09'
  ),
  (
    'Network Software Co-op',
    'Cisco',
    'Remote, Canada',
    'Remote',
    'Winter 2027 · 4 months',
    '2026-08-24',
    'Canadian work authorization',
    'In-house summary: remote network software role focused on routing concepts, automated tests, and systems debugging.',
    array['Networking', 'Python', 'Linux', 'Testing'],
    array['C++', 'Routing protocols', 'Automation'],
    array['network', 'remote', 'software', 'co-op'],
    'https://www.cisco.com/c/en/us/about/careers.html',
    true,
    '2026-07-09'
  ),
  (
    'IT Data Analyst Co-op',
    'City of Vancouver',
    'Vancouver, BC',
    'Hybrid',
    'Fall 2026 · 4 months',
    '2026-07-28',
    'International eligible',
    'In-house summary: public-sector data co-op supporting service reports, spreadsheet cleanup, and dashboard maintenance.',
    array['Excel', 'SQL', 'Data cleaning', 'Communication'],
    array['Power BI', 'Public sector', 'Documentation'],
    array['data', 'analyst', 'dashboard', 'co-op'],
    'https://jobs.vancouver.ca/',
    true,
    '2026-07-09'
  );

create table public.tailoring_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (
    reason in (
      'signup_grant',
      'tailor_generation',
      'tailor_use',
      'purchase',
      'admin_adjustment',
      'admin_adjust'
    )
  ),
  ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.tailoring_credit_ledger is
  'Append-only tailoring credit ledger. Positive amounts grant credits; negative amounts consume credits after successful server-side generation.';

comment on column public.tailoring_credit_ledger.amount is
  'Positive for grants or purchases, negative for successful tailoring usage.';

create index tailoring_credit_ledger_user_idx
  on public.tailoring_credit_ledger(user_id);

create index tailoring_credit_ledger_created_at_idx
  on public.tailoring_credit_ledger(created_at);

create unique index tailoring_credit_ledger_one_signup_grant_idx
  on public.tailoring_credit_ledger(user_id)
  where reason = 'signup_grant';

alter table public.tailoring_credit_ledger enable row level security;

create policy "credit ledger select own"
on public.tailoring_credit_ledger
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.grant_signup_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tailoring_credit_ledger (
    user_id,
    amount,
    reason,
    metadata
  ) values (
    new.user_id,
    2,
    'signup_grant',
    jsonb_build_object('source', 'profiles_after_insert')
  )
  on conflict do nothing;

  return new;
end;
$$;

create trigger profiles_grant_signup_credits
after insert on public.profiles
for each row execute function public.grant_signup_credits();

create or replace function public.tailoring_credit_balance(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer
  from public.tailoring_credit_ledger
  where user_id = uid
    and (
      auth.role() = 'service_role'
      or auth.uid() = uid
    );
$$;

revoke all on function public.tailoring_credit_balance(uuid) from public;
grant execute on function public.tailoring_credit_balance(uuid) to authenticated, service_role;
