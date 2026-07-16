# CHATGPT_DIRECTOR_CONTEXT.md - COOPfinder

Use this file as context for a future temporary ChatGPT chat where ChatGPT should act as a product and engineering director. Its job should be to tell the user exactly what to do next and provide precise prompts to give coding agents such as Codex or Fable.

Last reviewed: 2026-07-16 (parser-credit production integration synchronized
through migration
`20260716064357_revoke_parser_reservation_client_writes.sql` and implementation
commit `5744ba72a3dae9008ff9ff95d0d641c0b0476caa`; Strategy Revision 2 remains
current).

Working method: drive implementation with **one narrow Codex prompt at a time**, drafted when a phase actually starts. Do not stockpile prompts for future phases in the docs. Record meaningful core sessions in `CODEX_SESSION_LOG.md`, including their verified commit range and real `/feedback` Session ID when available; never fabricate either verification or an ID.

Required working set: `PRODUCT_STRATEGY.md`, `DESIGN.md`,
`TECHNICAL_DESIGN.md`, `HANDOFF.md`, `CODEX_SESSION_LOG.md`, and `AGENTS.md`.
Read only the sections needed for the current narrow task.

Important note: `TASKS.md` is not present in this repo. Existing handoff docs state this is intentional.

---

## 1. Product Summary

COOPfinder is a productivity-first web app for Canadian university students managing co-op, internship, and early-career job applications.

Target users:
- Canadian co-op and internship students, especially SFU / UBC / Waterloo Engineering and Computer Science students.
- Students applying to many roles across Vancouver, Burnaby, Toronto, Waterloo, and remote/hybrid/on-site Canadian postings.
- Students who need to save jobs, tailor resumes, track deadlines, and avoid overstating their experience.

Main problem:
- Students manage many saved postings, deadlines, resume versions, and application statuses across disconnected tools.
- COOPfinder acts as an application command center: save jobs, analyze requirements, tailor resumes, track applications, and decide the next action.

Current positioning:
- Not a job board and not a flashy AI SaaS landing page.
- Positioning is "Canadian co-op application OS" or "application command center."
- The UI should feel like an Asana-inspired productivity app with Linear clarity, Notion structure, and Grammarly-like reviewable AI assistance.

Adopted strategy (2026-07-09, **revision 2**) — see `PRODUCT_STRATEGY.md`:
- **Core selling point:** "Found a role? Paste the link. COOPfinder extracts the requirements, compares them to your profile, helps you tailor a reviewed resume, exports a clean PDF, and sends you back to the original site to apply yourself."
- **Two job surfaces:** public moderated **job board** at `/board` (approved entries only; in-house summaries + `source_url` link-outs; user submissions enter `pending_review` and need founder approval) and private **My saved jobs** at `/jobs` (auth required; full raw text, matching, tailoring, tracking). A submitted job is always immediately usable privately; moderation gates public visibility only.
- **Product-led onboarding stays:** `/start` = paste-link hero (guests stash the link in the device draft; no AI, no server writes) + draft profile builder + deterministic match preview vs. approved board jobs + gate after the value moment. Login = "save your progress".
- Hybrid auth: public `/`, `/start`, `/board`, `/board/[id]`, `/board/submit` (submitting requires auth), `/login`; everything else private; guests hitting `/jobs` redirect to `/board`.
- 2 free tailoring credits at signup (server ledger); tracking free forever;
  planned GPT-5.6 Luna/Terra/Sol task routing is centrally configured; PDF
  export is deterministic (no AI in render path).
- Hard lines: no auto-apply, no scraping (one user-directed fetch per pasted URL only), no job-description text on the public board, no eligibility/outcome promises (DESIGN.md §22.4, §23.6).

---

## 2. Current Development Status (2026-07-16)

Completed migrations, chronological:
`202607090001_initial_mvp_schema.sql` ·
`202607090002_product_led_onboarding_delta.sql` ·
`202607090003_board_intake_export_v3.sql` ·
`202607120001_atomic_board_submission.sql` ·
`202607130001_unique_private_board_saves.sql` ·
`202607130002_master_profile_guest_import.sql` ·
`202607130003_fix_import_guest_draft_coalesce.sql` ·
`202607130004_fix_import_guest_draft_nullif.sql` ·
`202607130005_fix_import_guest_draft_hash_ambiguity.sql` ·
`202607130006_fix_save_master_profile_coalesce.sql` ·
`202607130007_applications_crud_foundation.sql` ·
`202607130008_atomic_application_creation.sql` ·
`202607130009_atomic_application_status.sql` ·
`202607130010_atomic_application_notes.sql` ·
`202607130011_fix_application_notes_whitespace.sql` ·
`202607130012_atomic_application_deadline.sql` ·
`202607130013_atomic_application_follow_up.sql` ·
`202607130014_atomic_application_deletion.sql` ·
`202607130015_atomic_job_extraction_persistence.sql` ·
`202607130016_atomic_parser_analysis_credits.sql` ·
`20260716042744_append_only_parser_analysis_credit_events.sql` ·
`20260716064357_revoke_parser_reservation_client_writes.sql`
(All twenty-two are committed and applied to the connected development
database. See section 8 for the exact behavioral coverage and remaining
limits.)

**Completed:**
1. Strategy Revision 2 documentation.
2. Schema Delta v3 (`202607090003_board_intake_export_v3.sql`).
3. `/start` v2 (guest URL/JD stash, guest profile draft, deterministic match preview, value-first gate; no guest server writes, no fetching, no AI).
4. Public `/board` and `/board/[id]` (approved/active/unexpired reads, filters, guest match notes, link-outs; guest `/jobs` → `/board` redirect; "Job board" vs "My jobs" navigation).
5. Public `/board/submit` page with an honest sign-in-required guest state;
   authenticated submission and private history remain gated. Submitters see
   Pending review / On the board / Not added / Archived status labels.
6. Atomic private/pending board submission — `submit_board_job_with_private_copy()` RPC (`202607120001_atomic_board_submission.sql`): identity forced from `auth.uid()`, status forced `pending_review`, `is_active` forced false, review fields not caller-suppliable, `SECURITY DEFINER` with empty `search_path`, authenticated-only execute; the earlier board-only RPC is revoked from authenticated callers. Full JD text only in `job_postings.raw_text`; private record links to the pending candidate.
7. Private saved-jobs CRUD on `/jobs` + `/jobs/[id]`: create/list/read/edit/delete, private raw-JD storage, private not-found behavior, search/filters over persisted rows, honest "Analysis not generated yet" state, tailoring unavailable for unprocessed jobs. Ownership always from the authenticated session; no service-role key in client code. Production Jobs pages no longer show mock jobs as the user's data.
8. Approved-board→private-job saving (`intake_source='board_save'`, `board_job_id` set; board summaries not copied as original JD text) with duplicate prevention via `job_postings_user_board_job_unique_idx` (`202607130001_unique_private_board_saves.sql`).
9. Master Profile Supabase persistence (`save_master_profile` RPC,
   `202607130002_master_profile_guest_import.sql` plus forward-only repair
   `202607130006_fix_save_master_profile_coalesce.sql`): transactional profile
   scalars, normalized/replaced skills, and delete-and-reinsert ordered
   evidence with persisted confirmation state; no mock student or AI call.
10. Authenticated guest-draft import (`import_guest_draft` RPC): detects/normalizes `localStorage["coopfinder.guest_draft.v1"]`; malformed drafts cause no server writes and stay local.
11. Non-destructive existing-account merge (explicit prompt; preserves populated fields, unions arrays case-insensitively, skips duplicates, deletes nothing).
12. Atomic and idempotent guest-draft import ledger (`guest_draft_imports`:
    server-computed canonical SHA-256 hash, `unique(user_id, draft_hash)`,
    per-user advisory transaction lock, `already_imported` handling).
13. Three forward-only `import_guest_draft()` repair migrations through
    `202607130005`; live authenticated normal import, sequential idempotency,
    canonical object-key normalization, true concurrent duplicate handling,
    and existing-account `auto`/`merge` behavior pass after the final repair.
14. Live two-user RLS isolation for `job_postings`, `profiles`,
    `master_profiles`, `master_profile_entries`, and `guest_draft_imports`;
    approved-board save/duplicate/privacy behavior; and production route,
    sign-out, direct-HTTP, and public `/board/submit` behavior.
15. `save_master_profile()` live persistence and rollback contract, including
    application-shaped payload compatibility, replacement/clearing behavior,
    fresh evidence IDs, zero-based order, and no partial state after a later
    invalid-entry failure.
16. Applications database foundation and atomic creation (`007`–`008`): one
    application per caller-owned private saved job, seven canonical statuses,
    persisted private timeline, per-user RLS, and exactly one initial event.
17. Persisted `/applications` tracker, Add Application flow, and private
    `/applications/[id]` detail with real timeline reads and the shared private
    not-found state for foreign/nonexistent IDs.
18. Atomic status, notes, deadline, and follow-up mutations (`009`–`013`): row
    locking, no-op detection, one minimal event per real change, private note
    text excluded from timeline metadata, and authenticated-only execution.
19. Authenticated application deletion (`014`): deletes the caller-owned
    application and cascaded timeline only, preserves its private job/company,
    makes the job eligible for creation again, and creates no deletion event.
20. Private pasted-text parser pipeline: canonical versioned extraction
    schema, deterministic confidence, server-only OpenAI Responses API,
    centralized `OPENAI_MODEL_LUNA` routing, authenticated owned-job lookup,
    atomic extraction persistence (`015`), extraction-to-persistence
    orchestration, authenticated Jobs server action, persisted Job Detail
    analysis display, and Analyze / Analyze Again controls for eligible
    `intake_source='pasted_text'` jobs.
21. Parser-analysis credit database foundation and ACL hardening (`016`–
    `018`): atomic
    reservation/finalization with a lifetime successful capacity of two and a
    rolling 24-hour attempt limit of three, plus append-only reserved/
    consumed/refunded accounting events. Migration `018` removes authenticated
    direct INSERT/UPDATE/DELETE reservation-table privileges while preserving
    authenticated own-row SELECT through RLS and reserve/finalize RPC execute.
22. Parser-credit production integration: Analyze and Analyze Again use the
    same authenticated action, reserve before provider invocation, and finalize
    successful work as consumed or post-reservation failures as refunded.

**Not completed** (do not claim these exist):
- Bounded user-directed URL intake with a manual pasted-text fallback.
- AI resume tailoring; production tailoring-credit consumption.
- Mechanical claim checker.
- Deterministic PDF export; DOCX export; file upload.
- Moderation dashboard; notifications.
- Calendar and Insights functionality; production document-management workflow.
- Final product-level end-to-end MVP QA after the remaining product phases.

Screens still rendering mock/local data: Dashboard, Resumes hub, Resume
Tailoring Workspace (full mock session for `j11` only), Calendar/Insights/
Documents/Settings. Applications tracker, detail, and eligible private
pasted-text Job analysis are now Supabase-backed;
the old fixture file still exists but is not imported by production routes.
A mock screen existing does not make its feature complete.

Evidence-confirmation trust boundary (implemented): user-authored evidence can be confirmed; editing confirmed evidence makes it unconfirmed; the user must explicitly reconfirm; future AI must treat `confirmed` as the boundary and never mark AI output confirmed.

Guest-import specifics (implemented): empty accounts auto-import valid drafts (guest-typed evidence arrives `confirmed = true`); stashed URL jobs keep `source_url`, pasted-text jobs keep `raw_text`; the import itself performs no fetch/scrape/AI parse and invents no metadata, though an authenticated user may analyze an imported pasted-text job later; title-less imports use the honest schema-required placeholder `Imported job - add title`. LocalStorage is cleared only on a complete matching `imported` / `already_imported` result; it remains stored on validation failure, invalid URL, Supabase unavailability, RPC failure, rollback, or a non-matching response.

---

## 3. Current Frontend Routes

Public routes: `/`, `/start`, `/board`, `/board/[id]`, `/board/submit`
(page is public; submitting requires auth), `/login`.
Private routes (enforced by `proxy.ts`): `/dashboard`, `/jobs`, `/jobs/[id]`,
`/applications`, `/applications/[id]`, `/resumes`, `/resumes/master`,
`/resumes/tailor/[jobId]`, `/calendar`, `/insights`, `/documents`,
`/settings`. Guests hitting `/jobs` are redirected to `/board`.

| Route | Purpose | Status |
|---|---|---|
| `/` | Authed → `/dashboard`; guest → `/start` | Complete |
| `/start` | Guest onboarding v2: URL/JD stash, guest profile draft, deterministic match preview, login gate | Complete (device-only; no server writes) |
| `/board` | Public moderated job board (approved/active/unexpired only), filters, guest match notes | Complete (Supabase-backed) |
| `/board/[id]` | Board detail: in-house summary, skills, source link-out; loading/empty/error/not-found states | Complete (Supabase-backed) |
| `/board/submit` | Public form and sign-in-required guest state; authenticated atomic private+pending submission and private history | Complete (Supabase-backed) |
| `/login` | Email/Google auth with `next`/`reason` params | Complete |
| `/jobs` | **My jobs** — private saved jobs: persisted CRUD, search, filters | Complete (Supabase-backed) |
| `/jobs/[id]` | Private saved-job detail: edit/delete, raw JD, persisted pasted-text analysis, Analyze / Analyze Again, honest unavailable states | Complete (Supabase-backed parser; tailoring still unavailable) |
| `/resumes/master` | Master Profile: persisted profile, skills, ordered evidence with confirmation state | Complete (Supabase-backed) |
| `/dashboard` | Overview (metrics, pipeline, deadlines, next actions) | UI complete, **mock data** |
| `/applications` | Persisted private tracker and atomic Add Application flow | Complete (Supabase-backed) |
| `/applications/[id]` | Persisted private detail, timeline, status/notes/deadline/follow-up/delete controls | Complete (Supabase-backed) |
| `/resumes` | Resume hub; upload disabled | Partial, mock |
| `/resumes/tailor/[jobId]` | Tailoring Workspace (full mock session for `j11` only) | UI complete, **mock data** |
| `/calendar`, `/insights`, `/documents` | Placeholders | Placeholder |
| `/settings` | Static mock profile | Partial, mock |

Main route flows and buttons:
- Sidebar Home -> `/dashboard`.
- Sidebar Jobs -> `/jobs`.
- Sidebar Applications -> `/applications`.
- Sidebar Resumes -> `/resumes`.
- Sidebar Calendar -> `/calendar`.
- Sidebar Insights -> `/insights`.
- Sidebar Documents -> `/documents`.
- Sidebar Settings -> `/settings`.
- Topbar search entry -> `/jobs`.
- Topbar Add job -> `/jobs` only. It does not open the Jobs page modal directly.
- Dashboard metric cards link to `/jobs`, `/applications`, or `/calendar`.
- Dashboard pipeline actions link to `/jobs`, `/resumes`, `/applications`, `/calendar`, or `/insights`.
- Dashboard recent job rows open `/jobs/[id]`.
- Dashboard recent job row next action opens either `/resumes/tailor/[id]` for tailoring jobs or `/applications`.
- Dashboard upcoming deadline items open `/jobs/[id]`.
- Dashboard AI next actions link to `/resumes/tailor/j11`, `/jobs`, and `/applications/app-8`.
- Sidebar "Job board" -> `/board` (public); sidebar Jobs is "My jobs" for authed users.
- Board entry/detail "View original posting" links out to `source_url`.
- Board detail "Save to my jobs" copies the entry into the user's `job_postings` (duplicate saves prevented).
- Jobs table row click opens `/jobs/[id]`.
- Jobs row action button also opens `/jobs/[id]`.
- Jobs page Add Job flow creates a persisted private `job_postings` row (paste text; URL stored as metadata only, never fetched).
- Eligible pasted-text Job Detail records expose Analyze / Analyze Again and
  render persisted extraction results; unsupported/missing cases stay honest.
  Both controls share the authenticated parser-credit-enforced server action.
  Blocked credit outcomes make no provider call and persist no new extraction.
- Persisted Job Detail still shows the honest disabled action "Tailor resume
  unavailable" because production tailoring is not implemented; the mock
  tailoring route remains reachable only from mock flows.
- Job Detail secondary buttons "Mark as ready", "Add deadline", and "Save notes" are disabled placeholders.
- Application Tracker cards open the caller-owned `/applications/[id]`.
- Application Tracker Board button is active; Table and Calendar remain
  disabled placeholders. Add Application uses the atomic creation RPC and
  lists only eligible caller-owned saved jobs.
- Application Detail back link returns to `/applications`; "View job detail"
  opens the preserved private `/jobs/[id]` record.
- Application Detail status, notes, deadline, follow-up, and delete controls
  persist through authenticated atomic RPCs. Delete requires confirmation,
  removes the application/timeline, preserves the saved job, then redirects to
  `/applications`.
- Foreign and nonexistent Application Detail IDs render the same private
  not-found state; Supabase-disabled builds never substitute mock data.
- Resume hub "Master profile" opens `/resumes/master`.
- Resume hub "Upload resume" is disabled.
- Master Profile back link returns to `/resumes`.
- Resume Tailoring back link returns to `/jobs/[jobId]`.
- Resume Tailoring "Master profile" opens `/resumes/master`.
- Resume Tailoring "Open application tracker" appears after local mark-ready and opens `/applications`.
- Resume Tailoring export buttons are disabled.
- Calendar empty-state action -> `/applications`.
- Insights empty-state action -> `/jobs`.
- Documents empty-state action -> `/resumes`.

Placeholder or fragile routes:
- No `/resumes/[id]` route exists.
- Resume version links currently point to `/resumes`, not a version detail page.
- `/resumes/tailor/[jobId]` exists for all mock jobs, but only `j11` has full tailoring session data (mock).
- No URL is ever fetched anywhere in the app today; `source_url` values are link-outs only.

---

## 4. Current Component Structure

Main layout components:
- `app/layout.tsx`: root layout, fonts, metadata.
- `app/(app)/layout.tsx`: app shell wrapper with sidebar, topbar, and responsive main canvas.
- `app/globals.css`: Tailwind v4 theme tokens and design colors.

Sidebar/topbar:
- `components/app/app-sidebar.tsx`: dark fixed sidebar on `md+`, nav, saved views, user footer.
- `components/app/app-topbar.tsx`: sticky topbar, breadcrumb, global search link, Add job link, disabled notifications, avatar menu.

Shared app components:
- `components/app/page-header.tsx`: standard page heading/action row.
- `components/app/card-section.tsx`: white card section with header and content.
- `components/app/empty-state.tsx`: dashed empty-state component with optional action link.
- `components/app/status-badge.tsx`: status and deadline badges.
- `components/app/metric-card.tsx`: dashboard metric card.

Dashboard:
- `app/(app)/dashboard/page.tsx`.
- `app/(app)/dashboard/loading.tsx`.
- `components/app/dashboard-recent-job-row.tsx`.
- Uses `MetricCard`, `CardSection`, `StatusBadge`, `DeadlineBadge`, and `EmptyState`.

Public board and submission:
- `app/(app)/board/page.tsx` and `app/(app)/board/[id]/page.tsx`.
- `app/(app)/board/submit/page.tsx` and `actions.ts`.
- `components/board/public-job-card.tsx`,
  `guest-draft-match-note.tsx`, `save-board-job-button.tsx`, and
  `board-submission-form.tsx`.
- `lib/board/*`: public queries, filters, dates, submission mapping, and types.

Jobs:
- `app/(app)/jobs/page.tsx`.
- `app/(app)/jobs/jobs-page-client.tsx`.
- `app/(app)/jobs/actions.ts`.
- `app/(app)/jobs/loading.tsx`.
- `components/jobs/private-job-form-modal.tsx` and
  `components/jobs/private-job-controls.tsx`.
- `components/jobs/job-analysis-control.tsx` provides the authenticated
  Analyze / Analyze Again UI for eligible private pasted-text jobs.
- `lib/ai/*` contains the versioned extraction schemas, deterministic
  confidence, server-only Luna provider, owned-job orchestration, persistence,
  parser-credit coordination, and safe view-model/action handling. The action
  path reuses `extractAndPersistPrivateJobAction`,
  `createPrivateJobExtractionActionHandler`, `extractAndPersistOwnedJob`,
  `extractAndPersistOwnedJobWithCredits`, and
  `createParserAnalysisCreditCoordinator` rather than duplicating provider or
  persistence logic.
- Jobs page client owns local UI state for filters, search, and modal
  visibility; rows and create/edit/delete mutations use authenticated
  Supabase queries/server actions.

Job Detail:
- `app/(app)/jobs/[id]/page.tsx`.
- `app/(app)/jobs/[id]/loading.tsx`.
- Uses local helper components inside the page plus the Job analysis control;
  persisted extractions render through safe analysis view models, with honest
  missing/unavailable states.

Resume tailoring:
- `app/(app)/resumes/page.tsx`.
- `app/(app)/resumes/master/page.tsx`.
- `app/(app)/resumes/master/master-profile-client.tsx`.
- `app/(app)/resumes/master/actions.ts` and `lib/master-profile/*` for
  authenticated reads, validation, and transactional persistence.
- `app/(app)/resumes/tailor/[jobId]/page.tsx`.
- `app/(app)/resumes/tailor/[jobId]/tailoring-workspace.tsx`.
- `app/(app)/resumes/tailor/[jobId]/loading.tsx`.
- `components/app/tailor/diff-text.tsx`: word-level diff highlighting.
- `components/app/tailor/suggestion-card.tsx`: reviewable AI suggestion with source evidence, accept/reject/edit.
- `components/app/tailor/trust-badge.tsx`: AI trust labels.
- `components/app/tailor/keyword-checklist.tsx`: keyword coverage list.

Guest draft and onboarding:
- `components/start/start-onboarding.tsx` and `lib/start/matching.ts`.
- `components/app/guest-draft-import-handoff.tsx`.
- `lib/guest-draft/*`: draft types, normalization/canonicalization, and
  device-storage helpers.

Application tracker/detail:
- `app/(app)/applications/page.tsx`.
- `app/(app)/applications/actions.ts`.
- `app/(app)/applications/add-application-dialog.tsx`.
- `app/(app)/applications/loading.tsx`.
- `app/(app)/applications/[id]/page.tsx`.
- `app/(app)/applications/[id]/loading.tsx`.
- `app/(app)/applications/[id]/application-status-form.tsx`.
- `app/(app)/applications/[id]/application-notes-form.tsx`.
- `app/(app)/applications/[id]/application-deadline-form.tsx`.
- `app/(app)/applications/[id]/application-follow-up-form.tsx`.
- `app/(app)/applications/[id]/application-delete-control.tsx`.
- `lib/applications/*`: persisted queries, types, and typed RPC helpers for
  creation, status, notes, deadline, follow-up, and deletion.
- Application cards are currently defined inside `applications/page.tsx`.
- Application detail renders only persisted timeline rows through a safe,
  event-specific metadata whitelist.

UI primitives:
- `components/ui/*`: shadcn/radix-style primitives including button, input, dropdown-menu, skeleton, tooltip, card, scroll-area, separator, avatar, badge.
- Do not hand-edit primitives unless there is a local bug.

---

## 5. Mock Data Structure

Mock data lives in `lib/mock/`. **Scope note (2026-07-13):** mock data now
backs only the not-yet-persisted screens (Dashboard, Resumes hub, Tailoring
Workspace, and board fallbacks). Maya Chen is a mock fixture, not the
production current user — persisted screens (`/board*`, `/jobs*`,
`/applications*`, `/resumes/master`) read real Supabase data. Applications and
Master Profile never initialize from mock data in production.

Files:
- `lib/mock/index.ts`: barrel export.
- `lib/mock-data.ts`: compatibility re-export from `./mock`.
- `lib/mock/types.ts`: all mock TypeScript types.
- `lib/mock/dates.ts`: `daysUntil` and `formatDeadline`; mock today is fixed to `2026-07-08`.
- `lib/mock/companies.ts`: company fixtures.
- `lib/mock/jobs.ts`: jobs, job analyses, and derived job requirements.
- `lib/mock/applications.ts`: retained tracker/application/timeline fixtures
  for compatibility and historical UI data; production Applications routes do
  not import it.
- `lib/mock/dashboard.ts`: dashboard metrics, pipeline stages, next actions.
- `lib/mock/resumes.ts`: student profile, master resume, resume bullets, resume versions, resume performance, older AI suggestions, older keyword checklist.
- `lib/mock/tailoring.ts`: full Tailoring Workspace session for Northstar Robotics `j11`.

Current mock data:
- Student: Maya Chen, SFU Engineering / Computing Science, Burnaby, international eligible.
- Jobs: TELUS, D-Wave, RBC, BlackBerry QNX, BC Hydro, Hootsuite, Shopify, SAP, Clio, Nokia, Northstar Robotics.
- Locations: Vancouver, Burnaby, Toronto, Waterloo.
- Roles: software co-op, embedded co-op, data analyst intern/co-op, cloud platform co-op, full stack co-op, network software co-op.
- Applications: 11 application records across Saved, Tailoring, Ready, Applied, Interview, Offer, Rejected.
- Resume versions: Software Co-op v3, Embedded v1, Data Analyst v2, Cloud Platform v1.
- Tailoring session: one full mock session for Northstar Robotics `j11`.

Duplicated or drift-prone mock data:
- Dashboard pipeline counts are manually maintained in `lib/mock/dashboard.ts` and can drift from `mockApplications`.
- `mockResumePerformance.versions` is `6`, while `mockResumeVersions` currently contains 4 entries.
- Status appears on both `mockJobs` and `mockApplications`; these can diverge.
- `mockAISuggestions` and `mockKeywordChecklist` in `resumes.ts` are older general mock data and separate from the newer Tailoring Workspace session in `tailoring.ts`.

Data still awaiting persistence or production generation:
- Dashboard metrics derived from persisted jobs/applications.
- Resume uploads metadata.
- Resume versions.
- URL-sourced job analyses/requirements; pasted-text analysis persistence is
  implemented.
- Tailoring sessions and suggestions.
- Keyword reports.
- Exported documents.
- Production tailoring-credit consumption. Parser-credit enforcement is
  implemented for Analyze and Analyze Again.

---

## 6. Design System Summary

Core visual direction:
- Asana-inspired productivity UI.
- Dark left sidebar.
- Light gray canvas.
- White rounded cards.
- Thin borders.
- Dense but calm workflows.
- Minimal accent color.
- Professional, student-friendly, trustworthy.

Important rules from `DESIGN.md`:
- Always show the next action.
- AI must be reviewable.
- No fake confidence.
- Workflow over search.
- Canadian co-op specificity.
- Use 8px spacing logic.
- Cards use white background, thin border, rounded corners, no heavy shadow.
- Buttons must have specific labels like "Tailor resume", "Save job", "Export PDF", "Mark as applied".
- Badges should cover status, term, location, work mode, match, deadline.
- Tables should be clean, compact, scannable, with row hover states.
- Kanban columns: Saved, Tailoring, Ready, Applied, Interview, Offer, Rejected.
- Empty states should explain what belongs there and offer one primary action.
- Loading states should use skeletons, not generic spinners.
- AI labels include "Suggested by AI", "Based on your existing resume", "Needs confirmation", "Potential unsupported claim", "Review before applying".
- Resume tailoring must show source evidence and warn on unsupported claims.

Things future agents must not change:
- Do not rewrite the app shell.
- Do not redesign completed screens.
- Do not replace the global design direction.
- Do not introduce purple gradient AI SaaS styling.
- Do not add decorative marketing visuals, neon palettes, or heavy animation.
- Do not replace existing app components without a clear reason.
- Keep using the current tokens in `app/globals.css`.
- Continue using `lucide-react` icons, despite `components.json` referencing Phosphor.

---

## 7. Technical Stack

Framework:
- Next.js `16.2.10`.
- App Router.
- React `19.2.4`.
- TypeScript.

Styling:
- Tailwind CSS v4.
- Theme tokens in `app/globals.css`.
- `shadcn/tailwind.css` and `tw-animate-css`.
- No Tailwind config file is currently used.

UI libraries:
- shadcn/Radix-style primitives in `components/ui`.
- `radix-ui`.
- `class-variance-authority`.
- `clsx`.
- `tailwind-merge`.
- `lucide-react`.
- `@phosphor-icons/react` is installed but not used in the app.

State management:
- No global state library.
- Local React `useState` / `useMemo` in client components.
- Supabase persistence exists for the public board, private jobs (including
  pasted-text extraction results), Applications, Master Profile, and
  guest-draft import; remaining screens use mock/local state.

Charts/tables/drag-and-drop:
- No chart library is implemented.
- No TanStack Table is installed or implemented.
- No drag-and-drop library is installed or implemented.
- Application Tracker is a visual board only.

Package scripts:
- `npm run dev`: `next dev`.
- `npm run build`: `next build --webpack`.
- `npm run start`: `next start`.
- `npm run lint`: `eslint`.
- `npm run typecheck`: `tsc --noEmit`.

Next.js note:
- `AGENTS.md` says this Next.js version may differ from model assumptions; read relevant docs in `node_modules/next/dist/docs/` before changing code.
- Dynamic page props use promise-style `params`.

---

## 7a. AI Architecture (Luna parser implemented; Terra/Sol planned)

- **Luna parser route — implemented:** private pasted-text JD extraction uses
  a server-only OpenAI Responses API provider, canonical versioned schemas,
  deterministic confidence, and centrally resolved `OPENAI_MODEL_LUNA`.
  Feature code does not hardcode a production model ID. The result is persisted
  atomically through migration `015` and displayed on the owned Job Detail.
- **Parser-credit action path — implemented:** Analyze and Analyze Again share
  `extractAndPersistPrivateJobAction`. Its handler calls the server-only
  `extractAndPersistOwnedJobWithCredits` coordinator, which uses the
  request-bound authenticated Supabase client and the existing RPCs' derived
  `auth.uid()` ownership. Only `reserved` proceeds through the existing
  `extractAndPersistOwnedJob` provider/persistence path. `no_credits`,
  `daily_limit`, and `unsupported_source` return their typed results;
  `invalid_input` returns invalid-job-text; unavailable, malformed, or
  transport-failure reservation results return sanitized credit-unavailable.
  Blocked results invoke neither provider nor persistence. Successful
  persistence, including `already_persisted`, finalizes as `consumed`; failures
  after reservation finalize as `refunded`. A finalization transport failure
  receives exactly one idempotent retry without repeating provider or
  persistence work. Reservation IDs remain server-only, and blocked or failed
  Analyze Again leaves the previous persisted analysis intact. Normal user
  execution uses no service-role client. Parser credits remain separate from
  tailoring credits.
- **Terra route — planned only:** requirement normalization, confirmed-
  evidence mapping, directional explanations, next actions, and first-pass
  claim classification are not runnable production routes.
- **Sol route — planned only:** nuanced evidence-backed resume suggestions,
  supported rewriting, difficult claim review, and final semantic review are
  not runnable production routes.

`OPENAI_API_KEY` and `OPENAI_MODEL_LUNA` configure the implemented parser.
`OPENAI_MODEL_TERRA` and `OPENAI_MODEL_SOL` remain future configuration names;
their presence does not make Terra or Sol runnable. Do not invent or document
specific model values beyond the environment-driven routing contract.

The broader planned policy remains: invalid or unclear extraction should fail
honestly or follow a deliberately implemented bounded escalation path; future
resume suggestions must retain confirmed source-evidence references and remain
accept/reject/edit reviewable; unsupported claims block readiness/export; and
final PDF rendering must use accepted reviewed content with no AI call.
TECHNICAL_DESIGN.md §3 remains canonical for the target architecture.

---

## 8. Current Quality & Verification Status

Repository evidence reviewed through parser-credit integration log commit
`202556f85cfd8b856aea4ceb32a112675703fa0d`, including reservation-table
privilege hardening commit `2276ef39a1a6dfc128bfe8d4677c7385302fbab8`
and Analyze integration commit
`5744ba72a3dae9008ff9ff95d0d641c0b0476caa`. The worktree was clean before
this documentation-only update.

Verification completed during the reported backend phases:
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed (`next build --webpack`; Turbopack production
  builds previously produced `next start` 500s).
- Configuration-disabled `/resumes/master` renders without mock production
  data.
- `/start`, `/board`, and `/jobs` fallback routes remained functional.
- Browser console showed no warnings or errors during the reported checks.

Live verification completed against the development Supabase project:
- All twenty-two migrations through
  `20260716064357_revoke_parser_reservation_client_writes.sql` are committed,
  applied, and represented in linked remote migration history. Migration 006
  replaces only
  `save_master_profile(jsonb,jsonb,jsonb)`, removes invalid qualification from
  five `COALESCE` and five `NULLIF` expressions, and preserves its signature,
  return type, `SECURITY DEFINER`, empty `search_path`, and authenticated-only
  execute grant.
- `save_master_profile()` passed initial persistence, scalar updates, skill
  normalization/replacement/clearing, zero-based ordered evidence
  delete-and-reinsert, confirmation persistence, fresh IDs, caller ownership,
  application-shaped payload compatibility, and deterministic later-failure
  rollback with no partial state.
- `import_guest_draft()` passed normal import, exact sequential repeat,
  canonical object-key-order normalization, barrier-synchronized concurrent
  duplicate calls (exactly one `imported`, one `already_imported`), advisory
  lock/ledger behavior, existing-account `auto` no-write confirmation, and
  explicit non-destructive `merge` with normalized duplicate skipping.
- Two-user RLS behavior passed narrowly for `job_postings`, `profiles`,
  `master_profiles`, `master_profile_entries`, and `guest_draft_imports`,
  including cross-user exact-ID isolation, write protection, spoof rejection,
  server-only ledger writes, supported own mutations, and anonymous isolation.
- The real approved-board save action passed first save, sequential duplicate,
  live unique-index rejection, independent second-user save, per-user RLS,
  unavailable-board rejection, and raw-JD/public-summary privacy checks.
- Production-build route behavior passed for guest/authenticated root, public
  and private routes, `/jobs` special redirects, sign-out, direct HTTP, and
  unauthenticated mutation rejection. The repaired public `/board/submit`
  returns 200 for guests, shows no private history, and sends mutation attempts
  to `/login?next=%2Fboard%2Fsubmit&reason=submit_board_job` with zero writes.
- Applications live verification covers the foundation and RPCs in `007`–
  `014`: atomic create/idempotency, seven statuses, persisted tracker/detail/
  timeline, status/no-op/event behavior, private notes without note text in
  metadata, deadline and follow-up set/change/clear behavior, authenticated
  deletion, foreign/nonexistent equivalence, anonymous/two-user isolation,
  concurrent serialization, saved-job preservation, recreation eligibility,
  honest no-Supabase states, and scoped cleanup to zero.
- The private pasted-text parser pipeline passed its reported schema,
  confidence, provider, owned-job, atomic persistence, orchestration, server-
  action, and Job Detail control/display checks without claiming a live
  authenticated OpenAI success where none was demonstrated.
- Parser-credit verification covered lifetime capacity, refund semantics,
  rolling 24-hour attempts and boundary behavior, concurrent reservations near
  both limits, concurrent consume/refund/mixed finalization, idempotency,
  append-only event uniqueness/consistency, ownership isolation, anonymous
  rejection, cleanup, and noninterference with tailoring credits. The database
  work made no OpenAI API request.
- Migration `018` verified that authenticated retains reservation-table SELECT
  through RLS, no longer has direct INSERT/UPDATE/DELETE table privileges, and
  can still execute the authenticated reserve/finalize RPCs.
- Parser-credit action verification passed 136 focused tests, lint, typecheck,
  and the production webpack build. Blocked reservation outcomes made zero
  provider, persistence, and finalization calls. Success made one reserve, one
  provider call, one persistence operation, and one successful finalization.
  Provider and persistence failures finalized as refunds. Finalization
  transport failure received exactly one retry without repeated provider or
  persistence work, and failed re-analysis preserved existing persisted
  analysis. No real OpenAI API request was made.
- The parser-credit action integration is `CONDITIONALLY COMPLETE`: production
  integration and repository verification passed, and the database lifecycle
  was verified live. The deployed Server Action was not tested with a fake
  provider because safe injection would require an unauthorized production
  testing bypass. This is a verification limitation, not a known defect; no
  deployed fake- or real-provider success is claimed.

Current known risks (narrow, accurate):
1. Guest-import mid-transaction rollback is conditionally complete, not
   behaviorally passed: all caller-controlled constraint-sensitive values are
   validated before writes, and later ownership, IDs, titles, intake source,
   and ledger values are derived or fixed. No safe deterministic post-write
   failure exists without altering production behavior, so none was
   manufactured. It did not block the completed Applications CRUD phase.
2. The required placeholder title `Imported job - add title` creates an
   explicit review step before an imported job is useful.
3. Private manual job + company creation are separate RLS-protected writes; a
   failed job insertion may leave a harmless unused company row (MVP
   cleanup debt, not a blocker).
4. Existing duplicate board saves intentionally cause the unique-index
   migration to fail rather than silently preserving invalid duplicates.
5. There is no permanent browser/database integration-test suite for the
   Applications flows; verified coverage used disposable live fixtures.
6. The deployed Server Action was not tested with a fake provider because that
   would require an unauthorized production testing bypass. Repository and
   live database lifecycle verification passed; this is not a known defect.
7. No live authenticated OpenAI success is proven. URL intake, production
   tailoring, claim checking, and deterministic export remain unimplemented.

Known fragile areas (frontend):
- Mock/local state remains in Dashboard, Resumes hub, and the Tailoring
  Workspace (only `j11` has a full mock tailoring session).
- Dashboard metrics/pipeline counts can drift from application mock data.
- Application board is horizontally scrollable with a large min width;
  mobile behavior is improved but not deeply optimized.
- `TailorLoading` skeleton still suggests a three-panel workspace while the
  actual workspace is main draft plus right rail.

---

## 9. Important Product Constraints

Do not expand outside the active, explicitly requested narrow phase:
- Backend, auth, or database behavior beyond the completed foundations.
- Real AI API.
- Real scraping.
- File upload.
- Export.
- Automatic applying.

Product safety constraints:
- No automatic job applications.
- No silent AI resume changes.
- AI resume suggestions must be reviewable.
- AI must not invent resume experience.
- AI must not invent metrics, tools, roles, awards, internships, or projects.
- Unsupported or uncertain suggestions must be labeled and reviewable.
- Match scores are directional only.
- Do not imply guaranteed interviews, hiring outcomes, or "perfect matches."
- User must review before applying or exporting.

Current backend status:
- Supabase auth is implemented (hybrid public/private via `proxy.ts` — never a blanket wall).
- Twenty-two committed and applied migrations exist through
  `20260716064357`
  (section 2); `/board*`, `/jobs*`, `/applications*`, and `/resumes/master`
  are wired to Supabase with honest disabled states when env vars are absent.
  Private pasted-text Jobs can persist and display Luna parser results through
  migration `015`.
- A server-only OpenAI Responses API parser is implemented for owned pasted-
  text jobs. No URL is fetched, no scraping exists, and the board stays hand-
  moderated (full JD text is never republished through `board_jobs`).
- Analyze and Analyze Again now enforce parser credits through the authenticated
  request-bound Supabase action path. Reservation/finalization and event
  accounting remain database-authoritative; normal user execution uses no
  service-role client. Tailoring credits remain a separate schema/ledger
  foundation with no production consumption.
- Dashboard, Resumes hub, Tailoring Workspace, Calendar, Insights, Documents,
  and Settings still render mock/local state.

---

## 10. Current Known UX Issues

General:
- Persistence exists for board, private jobs and pasted-text analysis,
  Applications, and Master Profile; Dashboard, Resumes hub, and Tailoring
  remain mock/local.
- Topbar "Add job" routes to `/jobs`; it does not open the intake flow directly.
- Notifications are disabled; sign out works.
- Mock-data screens still contain fake "Original posting" URLs; persisted jobs use real user-entered `source_url` values (link-outs only, never fetched).
- No toasts or success confirmations beyond inline status changes.
- Empty states are present, but not all include examples as requested in `DESIGN.md`.
- The app shell still uses mock `currentUser` strings as cosmetic fallbacks (breadcrumb term, avatar fallback); real profile data is never faked on persisted screens.

Dashboard:
- Dashboard counts are manually maintained and can drift from actual mock data.
- Pipeline is a list/progress summary, not a chart.
- Resume performance says 6 versions while mock resume version list has 4.

Jobs (persisted):
- Jobs table is desktop-first and horizontally scrolls on smaller widths.
- Saved jobs are persisted and can create one tracked application through the
  existing Add Application flow. Eligible pasted-text jobs can run Analyze /
  Analyze Again and display persisted results; jobs without a usable persisted
  extraction retain honest missing/unavailable states.
- Imported guest jobs carry the `Imported job - add title` review placeholder until edited.
- Filter selects are simple native selects; no chips or saved filters.

Job Detail (persisted):
- Real tailoring remains unavailable; parser analysis does not imply a
  production tailoring workflow.
- Analyze and Analyze Again reserve parser credit before provider work;
  no-credit, rolling-limit, unsupported-source, invalid-input, and sanitized
  credit-unavailable outcomes are shown without replacing prior analysis.
- `source_url` is a link-out only; nothing is fetched or scraped.

Applications:
- Application Tracker has no drag-and-drop.
- Table and calendar toggles are disabled placeholders.
- Add Application is persisted and limited to eligible caller-owned saved jobs.
- Board is horizontally wide and not card-adaptive on mobile.
- Application Detail has no resume attachment/version control and supports no
  arbitrary user-created timeline entries.
- Recruiter-contact management, notification automation, and Calendar
  integration are not implemented.
- There is no permanent browser/database integration-test suite for these
  flows; live verification used disposable fixtures.

Resumes and Master Profile:
- Resume upload is disabled (file upload not implemented).
- Master Profile edits/additions/deletions persist to Supabase via `save_master_profile` (see section 2); evidence confirmation state persists too.
- No import from PDF/DOCX.
- No resume version detail route.
- No actual resume version list page beyond the empty-ish hub.

Resume Tailoring Workspace:
- Full session exists only for `j11`.
- Save version only changes local button state.
- Mark as ready only changes local workspace status and shows a tracker link.
- Marking ready does not mutate the persisted Applications tracker.
- Save version is allowed before all suggestions are reviewed.
- Readiness includes "Version saved" but `canMarkReady` only checks all reviewed and no unsupported accepted; it does not require version saved.
- Unsupported accepted suggestions block readiness unless edited, but accepted unsupported text still remains in the draft until user undoes/edits.
- Export PDF/DOCX disabled.
- Layout is desktop-first; mobile/tablet editing experience is not deeply optimized.
- Loading skeleton suggests a three-panel workspace, while actual implementation has main draft plus right rail.

---

## 11. Next Steps (2026-07-16)

### Applications CRUD phase — complete

The pre-Applications gate and Applications phase are complete. Linked history
now runs through `202607130014`. Live coverage includes the earlier Master
Profile/guest-import/board/route contracts plus Applications creation,
tracker/detail/timeline, status, notes, deadline, follow-up, deletion,
recreation, isolation, concurrency, and preservation behavior. Guest-import
post-write rollback remains conditionally unexercised because that RPC exposes
no safe caller-controlled later failure; this is documented, not a blocker.

### Immediate next boundary: bounded user-directed job URL intake

The private pasted-text parser, parser-credit migrations through `018`, and
production Analyze / Analyze Again credit enforcement are complete; do not redo
them. The next product boundary is **bounded user-directed job URL intake with a
manual pasted-text fallback**.

### Remaining product phases (in order)

1. Bounded user-directed job URL intake with a manual pasted-text fallback.
2. AI resume tailoring with reviewable source evidence and the existing
   credit boundaries.
3. Mechanical claim checker.
4. Deterministic PDF export.
5. Final MVP integration and end-to-end QA.

One-week MVP execution priorities: PRODUCT_STRATEGY.md §12. Do not add
speculative post-MVP phases.

---

## 12. Codex Prompt Policy

Work is driven by **one narrow Codex prompt at a time**, drafted when its
phase actually starts — prompts for future phases are intentionally NOT
stored in this document. The next prompt should cover only the bounded
user-directed job URL intake boundary in section 11. Do not turn that boundary
into unrestricted scraping, crawling, or arbitrary URL fetching. Draft later
prompts only when their phase starts, using
PRODUCT_STRATEGY.md, TECHNICAL_DESIGN.md, HANDOFF.md §8–9, and the warnings
below. Completed phases (board submission, private Jobs CRUD, Master Profile
persistence, guest-draft import, Applications CRUD, pasted-text parsing, and
migrations `015`–`018`, including parser-credit Analyze integration) must not
be redone.

For every meaningful core task, the director must require this completion
sequence: implement one narrow task; finish all automated and manual
verification; review the diff and exclude unrelated files; create a focused
local implementation commit; record its exact hash or genuine inclusive
implementation range; record the verified real Session ID for the actual Codex
session; complete both existing traceability fields in
`CODEX_SESSION_LOG.md`; then create a separate small log-only documentation
commit. When tasks continue in the same Codex session, reuse its already
verified Session ID and distinguish the tasks by their implementation hashes
or ranges. Run `/feedback` only for a new conversation, when the current
session's ID is unknown, or when session continuity is uncertain. The separate
commit is necessary because an implementation commit cannot contain its own
final hash. Neither commit is pushed without explicit user permission.

Prompts must classify a task as `CONDITIONALLY COMPLETE`, not `PASS`, when its
implementation hash or range is missing or no verified Session ID is available
for the actual session. A task in the same continuing session is not
conditional merely because `/feedback` was not rerun when its verified ID was
already known. If verification fails, no partial implementation commit is
created just to obtain a hash. If unrelated worktree changes prevent a focused
commit, the agent stops and reports the blocker. Never reuse an ID across
different sessions or infer, fabricate, shorten, reconstruct, or substitute a
Session ID; never invent verification or Git evidence. Final reports must state
the exact implementation hash or range, the exact log-only commit hash, and the
exact real `/feedback` Session ID.

---

## 13. Warnings For Future Agents

- Do not rewrite the app shell.
- Do not redesign completed screens.
- Do not replace the design system.
- **Do not redo completed backend work:** board submission (`/board/submit` +
  `submit_board_job_with_private_copy`), private Jobs CRUD, Master Profile
  persistence (`save_master_profile`), guest-draft import
  (`import_guest_draft` + `guest_draft_imports`), and Applications CRUD through
  deletion/recreation (`007`–`014`), private pasted-text parsing (`015`), and
  parser-credit database foundations and ACL hardening (`016`–`018`), and
  production Analyze credit enforcement are done — extend, don't rewrite.
- Do not add large dependencies without reason.
- Do not expose secrets or env values.
- **No blanket scraping or crawling, ever; no CAPTCHA/login-wall/bot-protection/access-control bypasses.** Future URL intake is one user-directed fetch with paste fallback.
- **No auto-apply, ever** — users submit applications themselves on the original site.
- **Never republish full job-description text through `board_jobs`**; raw pasted JD belongs only in private `job_postings.raw_text`. User submissions require moderation before public visibility.
- Do not pretend disabled backend actions work; do not remove honest disabled/placeholder states without implementing the feature.
- Do not invent resume experience, metrics, skills, tools, roles, or claims; never mark AI output as confirmed evidence.
- Do not imply eligibility, interviews, offers, or hiring outcomes; match scores are directional.
- The Luna parser route is runnable through `OPENAI_MODEL_LUNA`; Terra and Sol
  remain planned only. Follow the centralized task policy in
  TECHNICAL_DESIGN.md §3 and never hardcode model IDs.
- Parser credits are enforced in Analyze and Analyze Again through the existing
  authenticated action and persistence path. Keep reservation IDs and
  diagnostic details server-only, and keep parser credits separate from
  tailoring credits.
- Final PDF rendering must be deterministic — no AI call in the render path.
- Preserve meaningful Codex session evidence in `CODEX_SESSION_LOG.md` using
  the mandatory verified implementation commit → verified Session ID for the
  actual session → completed log fields → separate log-only commit sequence.
  Reuse a known verified ID only within the same continuing session; run
  `/feedback` for a new, unknown, or uncertain session. Missing real
  traceability is `CONDITIONALLY COMPLETE`; never invent IDs, verification,
  commits, or pushes.
- Do not push implementation or session-log commits unless the user explicitly
  requests it.
- Do not replace `lib/mock/` abruptly; swap screens to Supabase per phase.
- Do not ignore `AGENTS.md`; read Next.js docs from `node_modules/next/dist/docs/` before code changes.

---

## 14. How To Run The Project

Install:

```bash
npm install
```

Dev:

```bash
npm run dev
```

If the dev server needs a specific port:

```bash
npm run dev -- --port 3000
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Typecheck:

```bash
npm run typecheck
```

Start production build:

```bash
npm run start
```

Required env vars today (`.env.example` lists names only):
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required
  for auth and the persisted screens (`/board*`, `/jobs*`, `/applications*`,
  `/resumes/master`).
  Without them the app still runs: those screens show honest
  configuration-disabled states, and mock-data screens keep working.

Parser env vars required to invoke implemented AI extraction:
- `OPENAI_API_KEY`
- `OPENAI_MODEL_LUNA`

Planned model env names (no runnable Terra/Sol production routes yet):
- `OPENAI_MODEL_TERRA`
- `OPENAI_MODEL_SOL`
- Optional storage/export variables later

Never commit real secret values. Use `.env.local` locally and `.env.example` for variable names only.
