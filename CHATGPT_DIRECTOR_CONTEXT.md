# CHATGPT_DIRECTOR_CONTEXT.md - COOPfinder

Use this file as context for a future temporary ChatGPT chat where ChatGPT should act as a product and engineering director. Its job should be to tell the user exactly what to do next and provide precise prompts to give coding agents such as Codex or Fable.

Last reviewed: 2026-07-09.

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

Adopted go-to-market strategy (2026-07-09): **product-led onboarding** — see `PRODUCT_STRATEGY.md`.
- Guests get a public `/start` guided profile builder, a small curated starter catalog on `/jobs`, and deterministic (non-AI) match feedback before any login.
- Login is positioned as "save your progress", shown after the value moment.
- Auth is a hybrid public/private route model. Do NOT protect all app routes.
- New accounts get 2 free tailoring credits (server-side ledger). Application tracking is free.
- Match language rules: "N roles match your profile", never "you are eligible" (DESIGN.md §22.4).

---

## 2. Current Development Status

Completed frontend screens:
- App shell with dark sidebar and topbar.
- Dashboard.
- Jobs page.
- Job Detail page.
- Application Tracker.
- Application Detail.
- Resume hub.
- Master Profile.
- Resume Tailoring Workspace.
- Placeholder Calendar, Insights, Documents, and Settings pages.

Partially completed screens:
- Resume hub: upload is disabled and only routes to Master Profile.
- Calendar: empty-state placeholder only.
- Insights: empty-state placeholder only.
- Documents: empty-state placeholder only.
- Settings: static mock profile only.
- Application Tracker: board is visual/static; table/calendar toggles and add application are disabled placeholders.

Backend groundwork present but not wired:
- `supabase/migrations/202607090001_initial_mvp_schema.sql` (profiles, companies, job_postings, applications, timeline, master profile, resume versions, usage_counters — all with RLS).
- `lib/supabase/` browser/server/env client helpers.
- `.env.example` with Supabase variable names.
- A **delta migration is still needed** for `catalog_jobs` + `tailoring_credit_ledger` (SQL in TECHNICAL_DESIGN.md "Auth & Guest Model v2" §D).

Not implemented:
- Auth wiring (no login page, no middleware, no session usage).
- Database persistence in any screen (all screens still render mock data).
- Real AI API.
- Real job scraping or URL fetch.
- File upload.
- PDF/DOCX export.
- Notifications.
- Sign out.
- Real drag-and-drop.
- Real resume version detail pages.

Resume Tailoring Workspace status:
- Confirmed completed as a mock frontend screen.
- Route: `/resumes/tailor/[jobId]`.
- Full workspace currently exists for job `j11` / Northstar Robotics.
- Other job tailoring routes show an honest empty state pointing to `/resumes/tailor/j11`.
- The workspace supports accept, reject, edit, undo, source evidence, keyword coverage, readiness checks, save version local state, and mark ready local state.
- No state persists across routes yet.

---

## 3. Current Frontend Routes

| Route | File | Purpose | Status |
|---|---|---|---|
| `/` | `app/page.tsx` | Redirects to `/dashboard` | Complete |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Overview of metrics, pipeline, deadlines, AI next actions, recent jobs, resume performance | Complete mock |
| `/jobs` | `app/(app)/jobs/page.tsx`, `jobs-page-client.tsx` | Saved job database with table, filters, search, Add Job modal | Complete mock |
| `/jobs/[id]` | `app/(app)/jobs/[id]/page.tsx` | Job analysis/detail with AI summary, requirements, keywords, decision panel | Complete mock |
| `/applications` | `app/(app)/applications/page.tsx` | Kanban application tracker | Complete mock |
| `/applications/[id]` | `app/(app)/applications/[id]/page.tsx` | Single application detail, timeline, next step panel | Complete mock |
| `/resumes` | `app/(app)/resumes/page.tsx` | Resume hub and upload placeholder | Partial |
| `/resumes/master` | `app/(app)/resumes/master/page.tsx`, `master-profile-client.tsx` | Editable mock master profile/source experience pool | Complete mock |
| `/resumes/tailor/[jobId]` | `app/(app)/resumes/tailor/[jobId]/page.tsx`, `tailoring-workspace.tsx` | Resume Tailoring Workspace | Complete mock for `j11`; empty state for others |
| `/calendar` | `app/(app)/calendar/page.tsx` | Deadlines/interviews/follow-ups placeholder | Placeholder |
| `/insights` | `app/(app)/insights/page.tsx` | Response/performance analytics placeholder | Placeholder |
| `/documents` | `app/(app)/documents/page.tsx` | Exported resumes/cover letters/transcripts placeholder | Placeholder |
| `/settings` | `app/(app)/settings/page.tsx` | Static profile/preferences mock | Partial |

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
- Jobs table row click opens `/jobs/[id]`.
- Jobs row action button also opens `/jobs/[id]`.
- Jobs page Add Job button opens a local modal; saving adds a job to local component state only.
- Job Detail "Tailor resume" opens `/resumes/tailor/[jobId]`.
- Job Detail secondary buttons "Mark as ready", "Add deadline", and "Save notes" are disabled placeholders.
- Application Tracker cards open `/applications/[id]`.
- Application Tracker Board button is active; Table, Calendar, and Add application are disabled placeholders.
- Application Detail back link returns to `/applications`.
- Application Detail "View job detail" opens `/jobs/[id]`.
- Application Detail resume button links to `/resumes` for existing resume versions, or `/resumes/tailor/[jobId]` when no resume is attached.
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
- `/resumes/tailor/[jobId]` exists for all mock jobs, but only `j11` has full tailoring session data.
- Original posting links use mock external URLs and do not represent real scraping/fetching.

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

Jobs:
- `app/(app)/jobs/page.tsx`.
- `app/(app)/jobs/jobs-page-client.tsx`.
- `app/(app)/jobs/loading.tsx`.
- Jobs page client owns local `useState` for filters, search, add-job modal, and locally added jobs.

Job Detail:
- `app/(app)/jobs/[id]/page.tsx`.
- `app/(app)/jobs/[id]/loading.tsx`.
- Uses local helper components inside the page: trust labels, muted pills, detail items, bullet lists, keyword lists, analysis blocks.

Resume tailoring:
- `app/(app)/resumes/page.tsx`.
- `app/(app)/resumes/master/page.tsx`.
- `app/(app)/resumes/master/master-profile-client.tsx`.
- `app/(app)/resumes/tailor/[jobId]/page.tsx`.
- `app/(app)/resumes/tailor/[jobId]/tailoring-workspace.tsx`.
- `app/(app)/resumes/tailor/[jobId]/loading.tsx`.
- `components/app/tailor/diff-text.tsx`: word-level diff highlighting.
- `components/app/tailor/suggestion-card.tsx`: reviewable AI suggestion with source evidence, accept/reject/edit.
- `components/app/tailor/trust-badge.tsx`: AI trust labels.
- `components/app/tailor/keyword-checklist.tsx`: keyword coverage list.

Application tracker/detail:
- `app/(app)/applications/page.tsx`.
- `app/(app)/applications/loading.tsx`.
- `app/(app)/applications/[id]/page.tsx`.
- `app/(app)/applications/[id]/loading.tsx`.
- Application cards are currently defined inside `applications/page.tsx`.
- Application detail uses fallback timeline logic if no explicit timeline exists.

UI primitives:
- `components/ui/*`: shadcn/radix-style primitives including button, input, dropdown-menu, skeleton, tooltip, card, scroll-area, separator, avatar, badge.
- Do not hand-edit primitives unless there is a local bug.

---

## 5. Mock Data Structure

Mock data lives in `lib/mock/`.

Files:
- `lib/mock/index.ts`: barrel export.
- `lib/mock-data.ts`: compatibility re-export from `./mock`.
- `lib/mock/types.ts`: all mock TypeScript types.
- `lib/mock/dates.ts`: `daysUntil` and `formatDeadline`; mock today is fixed to `2026-07-08`.
- `lib/mock/companies.ts`: company fixtures.
- `lib/mock/jobs.ts`: jobs, job analyses, and derived job requirements.
- `lib/mock/applications.ts`: tracker columns, application records, application timeline.
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
- Added local jobs in `JobsPageClient` exist only in component state.

Data that should later move to Supabase:
- User profile and preferences.
- Companies.
- Saved job postings and raw job descriptions.
- Extracted job analyses/requirements.
- Applications and timelines.
- Resume uploads metadata.
- Master profile.
- Resume bullets/source experience.
- Resume versions.
- Tailoring sessions and suggestions.
- Keyword reports.
- Exported documents.
- Usage counters for free tier.

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
- No backend persistence.

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

## 8. Current Quality Status

Last known check results:
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Last verified during the frontend polish pass on 2026-07-09.
- This doc-only update did not require rerunning the checks.

Known errors or warnings:
- No current lint/typecheck/build errors are known.
- Production build uses `next build --webpack`. This was chosen because a previous Turbopack production build compiled but `next start` produced 500s due to missing `[turbopack]_runtime.js` chunks.
- Dev server may need approval in sandboxed Codex environments to bind to localhost.

Known fragile areas:
- Local-only state in Jobs, Master Profile, and Tailoring Workspace.
- Dashboard metrics/pipeline counts can drift from application mock data.
- Status is duplicated between jobs and applications.
- Resume Tailoring readiness is local only and does not update the tracker after navigation.
- Only `j11` has a full tailoring session.
- Application board is horizontally scrollable with a large min width.
- Mobile behavior is improved but not deeply optimized.
- `TailorLoading` skeleton still suggests a three-panel workspace while the actual current workspace is effectively main draft plus right panel.

---

## 9. Important Product Constraints

Do not implement unless explicitly requested:
- Backend.
- Auth.
- Database.
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
- Supabase schema migration and client helpers exist but are NOT wired to any screen (see section 2).
- No auth is implemented yet; the adopted model is hybrid public/private, not a blanket wall (PRODUCT_STRATEGY.md).
- No real Claude/OpenAI/Anthropic API is implemented.
- No scraping is implemented (and the starter catalog must stay hand-entered, never scraped).
- All screens still render mock/local frontend state.

---

## 10. Current Known UX Issues

General:
- No real persistence; local UI state resets on navigation or refresh.
- Topbar "Add job" routes to `/jobs`; it does not open the Add Job modal directly.
- Notifications and sign out are disabled.
- Some external "Original posting" links are fake mock URLs.
- No toasts or success confirmations beyond local button label/status changes.
- Empty states are present, but not all include examples as requested in `DESIGN.md`.

Dashboard:
- Dashboard counts are manually maintained and can drift from actual mock data.
- Pipeline is a list/progress summary, not a chart.
- Resume performance says 6 versions while mock resume version list has 4.

Jobs:
- Jobs table is desktop-first and horizontally scrolls on smaller widths.
- Add Job save only updates local component state.
- Added local job has no generated analysis or application record.
- Filter selects are simple native selects; no chips or saved filters.

Job Detail:
- Secondary actions are disabled: Mark as ready, Add deadline, Save notes.
- "Original posting" uses an external mock URL and does not fetch or scrape.
- Detail analysis is mock/directional.

Applications:
- Application Tracker has no drag-and-drop.
- Table and calendar toggles are disabled placeholders.
- Add application is disabled.
- Board is horizontally wide and not card-adaptive on mobile.
- Application Detail links existing resume versions to `/resumes`, not a specific version page.

Resumes and Master Profile:
- Resume upload is disabled.
- Master Profile edits/additions are local only.
- No import from PDF/DOCX.
- No resume version detail route.
- No actual resume version list page beyond the empty-ish hub.

Resume Tailoring Workspace:
- Full session exists only for `j11`.
- Save version only changes local button state.
- Mark as ready only changes local workspace status and shows a tracker link.
- Marking ready does not mutate `mockApplications`.
- Save version is allowed before all suggestions are reviewed.
- Readiness includes "Version saved" but `canMarkReady` only checks all reviewed and no unsupported accepted; it does not require version saved.
- Unsupported accepted suggestions block readiness unless edited, but accepted unsupported text still remains in the draft until user undoes/edits.
- Export PDF/DOCX disabled.
- Layout is desktop-first; mobile/tablet editing experience is not deeply optimized.
- Loading skeleton suggests a three-panel workspace, while actual implementation has main draft plus right rail.

---

## 11. Recommended Next Steps In Exact Priority Order

### 1. Full Frontend QA Pass

Goal:
- Verify the completed mock frontend is stable before backend work.

Why it matters:
- Backend work should not start on top of broken navigation, inconsistent UI, or hidden runtime errors.

Likely files:
- `app/(app)/**`
- `components/app/**`
- `components/ui/**`
- `lib/mock/**`

Acceptance criteria:
- `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- All routes load without 404/500.
- Buttons are either functional or visibly disabled with honest tooltips/copy.
- No obvious overlap, clipped text, or broken layout at desktop/tablet/mobile widths.

### 2. Route Flow Testing

Goal:
- Test every important route flow end to end in the browser.

Why it matters:
- The MVP is valuable only if users can click through Dashboard -> Job Detail -> Tailoring -> Tracker -> Application Detail.

Likely files:
- `app/(app)/dashboard/page.tsx`
- `app/(app)/jobs/jobs-page-client.tsx`
- `app/(app)/jobs/[id]/page.tsx`
- `app/(app)/applications/page.tsx`
- `app/(app)/applications/[id]/page.tsx`
- `app/(app)/resumes/tailor/[jobId]/tailoring-workspace.tsx`

Acceptance criteria:
- Dashboard recent jobs open Job Detail.
- Jobs table rows open Job Detail.
- Job Detail Tailor Resume opens Tailoring Workspace.
- Tailoring Workspace can review suggestions and return to tracker.
- Tracker cards open Application Detail.
- Application Detail links to related Job Detail and resume/tailoring routes.

### 3. Mock Data Cleanup

Goal:
- Make mock data single-source and less drift-prone.

Why it matters:
- Clean mock data makes future Supabase schema and migrations easier.

Likely files:
- `lib/mock/types.ts`
- `lib/mock/jobs.ts`
- `lib/mock/applications.ts`
- `lib/mock/dashboard.ts`
- `lib/mock/resumes.ts`
- `lib/mock/tailoring.ts`

Acceptance criteria:
- Dashboard counts derive from `mockApplications` where reasonable.
- Resume performance count matches `mockResumeVersions`.
- Job/application statuses are either clearly separated or derived consistently.
- Legacy mock suggestions/checklists are either documented as legacy or integrated into tailoring mock data.

### 4. State Management Cleanup

Goal:
- Centralize temporary frontend state before backend.

Why it matters:
- Tailoring "mark ready" and Jobs "add job" currently cannot affect other screens after navigation.

Likely files:
- `lib/mock/**`
- New client-side state provider if needed.
- App route client components.

Acceptance criteria:
- Still no backend.
- Add Job can update visible job list during the session.
- Tailoring local ready state can be reflected in tracker during the same session, if chosen.
- Implementation remains simple and easy to replace with Supabase.

### 5. Supabase Schema — mostly DONE; delta remains

Status:
- The initial migration and `lib/supabase/` client helpers already exist.

Remaining goal:
- Add the **delta migration** from TECHNICAL_DESIGN.md "Auth & Guest Model v2" §D.

Likely files:
- `supabase/migrations/**`

Acceptance criteria:
- `catalog_jobs` table exists, is readable by `anon` + `authenticated` only where `is_active = true`, is written only by service role, and is seeded with 20-40 hand-entered Canadian co-op roles (in-house summaries + `source_url` link-outs; no scraped text).
- `tailoring_credit_ledger` exists; users can only select their own rows; +2 `signup_grant` fires on profile creation; `tailoring_credit_balance()` helper works.
- No secrets committed.

### 6. Auth + Hybrid Routing + Guest Onboarding

Goal:
- Implement Supabase auth with the hybrid public/private route model and the guest `/start` experience from PRODUCT_STRATEGY.md.

Why it matters:
- The adopted strategy shows value before login; a blanket auth wall would contradict it.

Likely files:
- `app/login/**`, `app/start/**` (or `app/(public)/**`)
- `middleware.ts`
- `lib/supabase/**`
- Guest variants of `/jobs` and catalog job detail.
- App shell guest states (topbar Log in / Get started, sidebar lock icons).

Acceptance criteria:
- User can sign in/out; sign out no longer disabled.
- Middleware protects ONLY `/dashboard`, `/applications`, `/resumes`, `/calendar`, `/insights`, `/documents`, `/settings`. `/`, `/start`, `/jobs`, `/jobs/[id]`, `/login` stay public.
- Guest can complete `/start`: draft profile in `localStorage["coopfinder.guest_draft.v1"]`, live deterministic match counts against the catalog, zero AI calls, zero server writes.
- Gated actions (save, full analysis, tailor) show inline value-first prompts deep-linking to `/login?next=&reason=`; the server routes behind them enforce auth independently.
- Signed-in users never see guest gates; mock screens keep working for them.
- Match copy follows DESIGN.md §22.4.

### 7. Jobs CRUD

Goal:
- Persist saved jobs in Supabase.

Why it matters:
- Jobs are the root object for job analysis, tailoring, and applications.

Likely files:
- `app/(app)/jobs/**`
- `app/(app)/jobs/[id]/**`
- `lib/supabase/**`
- `app/api/jobs/**` if server handlers are used.

Acceptance criteria:
- Create/read/update/delete saved jobs.
- Pasted job description stored as user data.
- URL stored as metadata only; no scraping.
- Jobs page filters/search still work.
- "Save" on a catalog job copies it into the user's `job_postings` (preserving `source_url`, prefilling `extracted` from catalog fields).
- Guest-to-user draft migration server action works per TECHNICAL_DESIGN.md "Auth & Guest Model v2" §C: auto-migrate into empty accounts (`confirmed = true` for human-typed entries), explicit import prompt for accounts with existing data, idempotent via draft hash, localStorage cleared only on success.

### 8. Applications CRUD

Goal:
- Persist tracker applications and timeline.

Why it matters:
- Application Tracker is the operational core of the product.

Likely files:
- `app/(app)/applications/**`
- Supabase application queries/mutations.
- Potential shared status components.

Acceptance criteria:
- Create application from saved job.
- Update status.
- Add notes/follow-up/deadline.
- Application Detail reflects persisted data.
- Tracker counts derive from real applications.

### 9. Resume CRUD

Goal:
- Persist master profile and resume versions.

Why it matters:
- AI tailoring must cite and reuse trusted source experience.

Likely files:
- `app/(app)/resumes/**`
- `lib/supabase/**`
- Future `app/api/resumes/**`

Acceptance criteria:
- Master profile is persisted.
- User can add/edit/confirm source entries.
- Resume versions have real records.
- Resume version detail route exists or resume hub lists versions clearly.

### 10. AI Job Parser

Goal:
- Convert pasted job descriptions into structured job analysis.

Why it matters:
- Tailoring and match reports need reliable job requirements.

Likely files:
- `app/api/jobs/**` or `app/api/job-parser/**`
- `lib/ai/**`
- `lib/ai/schemas/**`
- `lib/ai/prompts/**`

Acceptance criteria:
- No URL scraping.
- User pastes job description.
- Server-side AI extracts title, company, location, deadline, skills, keywords, responsibilities.
- Structured output is validated.
- Failure states are recoverable.

### 11. AI Resume Tailoring

Goal:
- Generate real reviewable suggestions from master profile and job requirements.

Why it matters:
- This is the core differentiator.

Likely files:
- `app/api/tailor/**`
- `lib/ai/**`
- `app/(app)/resumes/tailor/[jobId]/**`
- `components/app/tailor/**`

Acceptance criteria:
- AI calls are server-side only.
- Suggestions include source experience IDs/bullet IDs.
- Unsupported claims are detected and labeled.
- User must accept/reject/edit suggestions.
- No automatic application or export.

### 12. Resume Claim Checker

Goal:
- Add mechanical validation that tailored claims are backed by master profile evidence.

Why it matters:
- Preventing hallucinated experience is a trust requirement.

Likely files:
- `lib/ai/claim-checker/**`
- `lib/ai/schemas/**`
- Tailoring route/server handler.
- Tailoring UI trust labels.

Acceptance criteria:
- Every generated bullet has a source reference or unsupported warning.
- Claims that introduce unknown tools/metrics/companies/roles are flagged.
- Unsupported suggestions cannot be marked ready without edit or rejection.

### 13. Export PDF/DOCX

Goal:
- Enable export only after review and claim checks.

Why it matters:
- Export is the moment where resume trust matters most.

Likely files:
- `app/api/versions/[id]/export/**`
- `lib/pdf/**`
- `app/(app)/documents/**`
- Tailoring actions.

Acceptance criteria:
- Export disabled until review is complete.
- PDF export works first.
- DOCX only if needed.
- Exported document is stored privately.
- Documents page lists exports.

---

## 12. Prompts For The Next Coding Agent

### Frontend QA Pass

```text
Read DESIGN.md, TECHNICAL_DESIGN.md, HANDOFF.md, CHATGPT_DIRECTOR_CONTEXT.md, package.json, app routes, components/app, and lib/mock.

Task:
Run a full frontend QA pass on the existing mock MVP.

Do not add backend.
Do not redesign the product.
Do not rewrite the app shell.
Do not change the design system.

Check:
1. npm run lint
2. npm run typecheck
3. npm run build
4. Every route loads
5. Dashboard -> Job Detail -> Tailoring -> Applications -> Application Detail route flow
6. Broken buttons or misleading enabled actions
7. Mobile/tablet/desktop layout issues
8. Empty states and loading skeletons
9. Badge/card/header consistency
10. Console/runtime errors

Fix only safe frontend issues.
After changes, summarize issues found, files changed, checks run, and remaining product gaps.
```

### Route Connection Pass

```text
Read the existing app routes and completed screens first.

Task:
Tighten the clickable MVP route flow.

Do not add backend.
Do not redesign screens.
Do not rewrite the app shell.
Use mock data only.

Required flows:
1. Dashboard recent job row opens Job Detail.
2. Jobs table row opens Job Detail.
3. Job Detail Tailor Resume opens Resume Tailoring Workspace.
4. Resume Tailoring Mark as Ready gives a clear path back to Application Tracker.
5. Application Tracker card opens Application Detail.
6. Application Detail links back to Job Detail and to resume/tailoring context.

Audit any placeholder buttons. If an action is not implemented, keep it disabled and label it honestly.
Run lint/typecheck/build and fix errors.
```

### Mock Data Cleanup

```text
Read lib/mock, Dashboard, Jobs, Job Detail, Application Tracker, Application Detail, Resumes, Master Profile, and Resume Tailoring Workspace.

Task:
Clean up mock data consistency only.

Do not change visual design.
Do not rewrite pages.
Do not add backend.

Goals:
1. Derive dashboard counts from mock applications where reasonable.
2. Align resume performance counts with mock resume versions.
3. Remove or document legacy duplicated mock AI suggestion/checklist data.
4. Ensure jobs/applications/resume versions reference each other consistently.
5. Keep Canadian co-op mock names and locations coherent.

After changes, run lint/typecheck/build and summarize what changed.
```

### Schema Delta + Auth + Guest Onboarding (NEXT — Phases 2-3)

```text
Read PRODUCT_STRATEGY.md, DESIGN.md section 22, TECHNICAL_DESIGN.md section "Auth & Guest Model v2", HANDOFF.md, CHATGPT_DIRECTOR_CONTEXT.md, the existing supabase/migrations and lib/supabase files, and the current app routes.

Task:
Implement the product-led onboarding foundation: schema delta, Supabase auth, hybrid public/private routing, and the guest /start experience.

Do not rewrite the app shell.
Do not redesign completed screens.
Do not implement AI calls, scraping, file upload, or export.
Do not protect all app routes; use the hybrid model exactly as documented.
Keep all existing mock screens working for signed-in users.

Implement:
1. Delta migration: catalog_jobs (anon-readable where is_active, service-role-written, seeded with 20-40 hand-entered Canadian co-op roles with in-house summaries and source_url link-outs) and tailoring_credit_ledger (+2 signup_grant trigger on profile creation, tailoring_credit_balance function, select-own-only RLS). Use the SQL in TECHNICAL_DESIGN.md "Auth & Guest Model v2" section D.
2. Supabase auth: /login page (email + Google) accepting next and reason query params (validate next as a same-origin relative path), sign out in the avatar menu.
3. middleware.ts protecting ONLY /dashboard, /applications, /resumes, /calendar, /insights, /documents, /settings. Guests hitting those redirect to /login?next=.
4. Public /start guided onboarding per DESIGN.md 22.2: draft profile stored in localStorage key coopfinder.guest_draft.v1 (schema in TECHNICAL_DESIGN.md section B), live deterministic matching against catalog_jobs (skill overlap + term + work authorization; no AI), match feedback panel, "Saved on this device only" labeling, signup prompt after the first non-zero match.
5. Guest variants of /jobs (starter catalog list) and catalog job detail (summary + skills + link out; full analysis, save, and tailor shown as inline gates per DESIGN.md 22.3).
6. Guest shell states: topbar Log in / Get started, sidebar lock icons that gate on click.
7. Root redirect: authed -> /dashboard, guest -> /start.

Language rules: use "N roles match your profile", "appears eligible based on what you entered", never "you are eligible" or outcome promises (DESIGN.md 22.4).

Run npm run lint, npm run typecheck, npm run build.
Verify: guest completes /start with zero AI calls and zero server writes; gated actions deep-link to /login with next and reason; signed-in users see no gates; private routes redirect guests.
Summarize files changed, migration contents, and remaining gaps.
```

### Jobs CRUD

```text
Read the current Jobs page, Job Detail page, lib/mock/jobs.ts, TECHNICAL_DESIGN.md, and CHATGPT_DIRECTOR_CONTEXT.md.

Task:
Implement real Jobs CRUD using Supabase.

Do not implement scraping.
Do not implement AI parsing yet unless explicitly included.
Do not redesign the Jobs UI.

Requirements:
1. Jobs page reads saved jobs from Supabase for the signed-in user.
2. Add Job modal creates a saved job using pasted job description and metadata.
3. Job Detail reads one saved job by id.
4. Edit/delete support only if it fits existing UI safely; otherwise leave clear placeholders.
5. Preserve filters/search/table behavior.

Run lint/typecheck/build and summarize behavior, files changed, and remaining gaps.
```

### Applications CRUD

```text
Read Application Tracker, Application Detail, lib/mock/applications.ts, TECHNICAL_DESIGN.md, and CHATGPT_DIRECTOR_CONTEXT.md.

Task:
Implement Applications CRUD using Supabase.

Do not redesign the tracker.
Do not implement drag-and-drop unless simple and stable.
Do not implement backend AI.

Requirements:
1. Tracker reads applications for the signed-in user.
2. Application Detail reads one application by id.
3. Status, follow-up, notes, deadline, and timeline data persist.
4. Empty-column states remain.
5. Disabled placeholders stay honest unless implemented.

Run lint/typecheck/build and summarize files changed and remaining gaps.
```

### AI Job Parser

```text
Read TECHNICAL_DESIGN.md sections on JD extraction, current Jobs page/Add Job modal, Job Detail page, and CHATGPT_DIRECTOR_CONTEXT.md.

Task:
Implement a server-side AI job parser for pasted job descriptions.

Do not implement URL scraping.
Do not expose API keys to the client.
Do not imply guaranteed results.

Requirements:
1. User pastes job description.
2. Server route extracts structured fields: title, company, location, work term, deadline, summary, required skills, nice-to-have skills, keywords, responsibilities.
3. Validate structured output.
4. Save raw text and extracted data.
5. Job Detail displays extracted analysis with trust labels.
6. Clear error/recovery state if parsing fails.

Run lint/typecheck/build and summarize behavior, files changed, and required env vars without secret values.
```

### AI Resume Tailoring

```text
Read DESIGN.md AI safety sections, TECHNICAL_DESIGN.md tailoring pipeline, current Resume Tailoring Workspace, mock tailoring data, and CHATGPT_DIRECTOR_CONTEXT.md.

Task:
Replace mock tailoring suggestions with real server-side AI tailoring.

Do not allow automatic applying.
Do not auto-accept AI suggestions.
Do not invent resume experience.
Do not expose API keys.

Requirements:
1. Send master profile and extracted job requirements to the server-side AI route.
2. Return structured tailoring suggestions with source experience/bullet IDs.
3. UI keeps accept/reject/edit/undo/source evidence behavior.
4. Unsupported or uncertain claims are labeled.
5. Mark as ready requires all suggestions reviewed and unsupported claims resolved.
6. Persist resume version only after user review.

Run lint/typecheck/build and summarize safety checks, files changed, and remaining risks.
```

### Resume Claim Checker

```text
Read TECHNICAL_DESIGN.md anti-hallucination validation, current Tailoring Workspace, mock master resume, and CHATGPT_DIRECTOR_CONTEXT.md.

Task:
Implement a claim checker for tailored resume suggestions.

Do not rely only on prompt instructions.
Do not let unsupported claims silently pass.

Requirements:
1. Every suggested bullet must cite a source bullet/experience or be labeled unsupported.
2. Check that tools, technologies, metrics, organizations, and role claims are present in the master profile before treating them as supported.
3. Flag unsupported or uncertain claims in the UI.
4. Prevent ready/export state until unsupported claims are edited or rejected.
5. Add focused tests for checker logic if a test setup exists.

Run lint/typecheck/build and summarize validation logic and limitations.
```

---

## 13. Warnings For Future Agents

- Do not rewrite the app shell.
- Do not redesign completed screens.
- Do not replace the design system.
- Do not implement backend before frontend QA is stable.
- Do not add large dependencies without reason.
- Do not expose secrets or env values.
- Do not scrape job URLs unless explicitly requested and legally/product-wise reviewed.
- Do not pretend disabled backend actions work.
- Do not remove disabled placeholder states without implementing the feature.
- Do not invent resume experience, metrics, tools, or outcomes.
- Do not imply guaranteed hiring outcomes.
- Do not replace `lib/mock/` abruptly; migrate data gradually when Supabase is introduced.
- Do not ignore `AGENTS.md`; read Next.js docs from `node_modules/next/dist/docs/` before code changes.
- Be careful with the dirty worktree. There are uncommitted MVP/polish changes; do not revert user or prior-agent work.

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

Required env vars today:
- None for the mock-only frontend.

Likely future env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` or equivalent AI provider key
- Optional storage/export/provider variables later

Never commit real secret values. Use `.env.local` locally and `.env.example` for variable names only.
