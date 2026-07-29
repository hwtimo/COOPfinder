-- Link user-authored resume edits to immutable generated originals.

alter table public.resume_versions
  add column parent_version_id uuid
    references public.resume_versions(id) on delete cascade,
  add column authorship text not null default 'ai_generated',
  add constraint resume_versions_authorship_check check (
    authorship in ('ai_generated', 'user_authored')
  ),
  add constraint resume_versions_parent_authorship_check check (
    (
      authorship = 'ai_generated'
      and parent_version_id is null
    )
    or (
      authorship = 'user_authored'
      and parent_version_id is not null
      and content ->> 'contractVersion' =
        'user-edited-tailored-resume-content-v1'
      and content ->> 'authorship' = 'user'
      and content ->> 'parentVersionId' = parent_version_id::text
    )
  );

create index resume_versions_parent_version_id_idx
  on public.resume_versions(parent_version_id);

-- Resume versions are append-only. New generated versions use the trusted
-- finalization function; user-authored children use the server-only admin
-- persistence boundary.
drop policy if exists "resume_versions insert own"
  on public.resume_versions;
drop policy if exists "resume_versions update own"
  on public.resume_versions;
drop policy if exists "resume_versions delete own"
  on public.resume_versions;
