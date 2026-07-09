# HANDOFF.md - COOPfinder Frontend Foundation

> **Purpose:** Hand this project to another coding agent without forcing them to rediscover the current frontend state.
>
> **Read before coding:** [DESIGN.md](DESIGN.md), [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md), [AGENTS.md](AGENTS.md), and this file.
>
> **Auth model changed (2026-07-09):** COOPfinder uses product-led onboarding with a hybrid public/private route model. **Do not blanket-protect all app routes behind login.** See §10 below and PRODUCT_STRATEGY.md.
>
> **Last updated:** 2026-07-09. The mock-only frontend MVP screens are built and connected into a clickable route flow.

---

## 1. Current Status

COOPfinder is a productivity-first application manager for Canadian university co-op and internship searches. The current codebase is a mock frontend MVP inside an existing app shell.

The app still has no backend, auth, database, real AI API, scraping, file upload, or export implementation.

The UI direction is established and should not be redesigned:

- Asana-inspired productivity app.
- Dark left sidebar.
- Light gray main canvas.
- White rounded cards.
- Thin borders.
- Calm, dense workflow UI.
- No purple-gradient AI SaaS look.

`TASKS.md` is intentionally not present.

---

## 2. Completed Screens

These screens/components are built in the existing app shell and should not be redesigned:

1. **App shell**
   - `app/(app)/layout.tsx`
   - `components/app/app-sidebar.tsx`
   - `components/app/app-topbar.tsx`

2. **Dashboard**
   - `app/(app)/dashboard/page.tsx`
   - `app/(app)/dashboard/loading.tsx`
   - Recent job rows open Job Detail.
   - Uses metric cards, pipeline summary, deadlines, AI next actions, recent jobs, and resume performance mock data.

3. **Jobs page**
   - `app/(app)/jobs/page.tsx`
   - `app/(app)/jobs/jobs-page-client.tsx`
   - `app/(app)/jobs/loading.tsx`
   - Table rows open Job Detail.
   - Includes table view, search, filters, status badges, and local mock Add Job modal.

4. **Job Detail page**
   - `app/(app)/jobs/[id]/page.tsx`
   - `app/(app)/jobs/[id]/loading.tsx`
   - Tailor Resume opens the Resume Tailoring Workspace.
   - Includes job summary, responsibilities, requirements, keywords, estimated match, missing keywords, status, and trust labels.

5. **Application Tracker**
   - `app/(app)/applications/page.tsx`
   - `app/(app)/applications/loading.tsx`
   - Kanban cards open Application Detail.
   - Includes compact clickable cards, column counts, empty-column states, table/calendar placeholders, and disabled add-application placeholder.

6. **Application Detail**
   - `app/(app)/applications/[id]/page.tsx`
   - `app/(app)/applications/[id]/loading.tsx`
   - Links back to Application Tracker, related Job Detail, and resume/tailoring routes when available.
   - Uses `mockApplicationTimeline` where present and a local fallback timeline otherwise.

7. **Resume hub and Master Profile**
   - `app/(app)/resumes/page.tsx`
   - `app/(app)/resumes/master/page.tsx`
   - `app/(app)/resumes/master/master-profile-client.tsx`
   - Resume upload remains disabled because file upload is out of scope.

8. **Resume Tailoring Workspace**
   - `app/(app)/resumes/tailor/[jobId]/page.tsx`
   - `app/(app)/resumes/tailor/[jobId]/loading.tsx`
   - `app/(app)/resumes/tailor/[jobId]/tailoring-workspace.tsx`
   - Mock AI suggestions can be accepted, rejected, edited, undone, saved locally, and marked ready locally.
   - Mark as ready visually changes the local status to Ready and offers a link back to Application Tracker.

9. **Placeholder utility screens**
   - `app/(app)/calendar/page.tsx`
   - `app/(app)/insights/page.tsx`
   - `app/(app)/documents/page.tsx`
   - `app/(app)/settings/page.tsx`

---

## 3. Current Route Flow

The clickable MVP route flow is:

1. Dashboard recent job row -> `/jobs/[id]`
2. Jobs table row -> `/jobs/[id]`
3. Job Detail "Tailor resume" -> `/resumes/tailor/[jobId]`
4. Resume Tailoring "Mark as ready to apply" -> local Ready status plus link to `/applications`
5. Application Tracker card -> `/applications/[id]`
6. Application Detail -> related `/jobs/[id]` and resume/tailoring route when possible

---

## 4. Current Routes

| Route | File | Status |
|---|---|---|
| `/` | `app/page.tsx` | Redirects to `/dashboard` |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Complete mock screen |
| `/jobs` | `app/(app)/jobs/page.tsx` + `jobs-page-client.tsx` | Complete mock screen |
| `/jobs/[id]` | `app/(app)/jobs/[id]/page.tsx` | Complete mock job detail |
| `/applications` | `app/(app)/applications/page.tsx` | Complete mock tracker |
| `/applications/[id]` | `app/(app)/applications/[id]/page.tsx` | Complete mock application detail |
| `/resumes` | `app/(app)/resumes/page.tsx` | Resume hub / upload placeholder |
| `/resumes/master` | `app/(app)/resumes/master/page.tsx` | Complete mock master profile |
| `/resumes/tailor/[jobId]` | `app/(app)/resumes/tailor/[jobId]/page.tsx` | Complete mock tailoring workspace |
| `/calendar` | `app/(app)/calendar/page.tsx` | Placeholder |
| `/insights` | `app/(app)/insights/page.tsx` | Placeholder |
| `/documents` | `app/(app)/documents/page.tsx` | Placeholder |
| `/settings` | `app/(app)/settings/page.tsx` | Static mock profile |

---

## 5. Main Components

Custom app components live in `components/app/`:

| Component | Purpose |
|---|---|
| `AppSidebar` | Persistent dark left navigation, active state, saved views, mock user footer |
| `AppTopbar` | Sticky top bar with breadcrumb, search entry to Jobs, Add Job link, disabled notifications, avatar menu |
| `PageHeader` | Standard page title, description, and actions row |
| `MetricCard` | Dashboard metric card with next-action link |
| `StatusBadge` | Application status pill with dot and label |
| `DeadlineBadge` | Deadline urgency pill |
| `EmptyState` | Dashed empty-state card with optional routed action |
| `CardSection` | White bordered card section with header and content area |
| `DashboardRecentJobRow` | Client row for clickable Dashboard recent jobs |
| `DiffText` | Word-level diff highlighting for resume suggestions |
| `SuggestionCard` | Reviewable AI suggestion card with accept/reject/edit |
| `TrustBadge` | AI trust label chip |
| `KeywordChecklist` | Resume Tailoring keyword status list |

shadcn/ui primitives live in `components/ui/`. Do not hand-edit generated primitives unless a local bug requires it.

---

## 6. Mock Data Files

Mock data lives under `lib/mock/`.

| File | Contents |
|---|---|
| `lib/mock/index.ts` | Barrel export for all mock data |
| `lib/mock-data.ts` | Compatibility re-export from `./mock` |
| `lib/mock/types.ts` | Shared mock types |
| `lib/mock/dates.ts` | `daysUntil`, `formatDeadline`; fixed mock today is `2026-07-08` |
| `lib/mock/companies.ts` | Company fixtures |
| `lib/mock/jobs.ts` | Jobs, job analyses, job requirements |
| `lib/mock/applications.ts` | Tracker columns, applications, and application timeline mock data |
| `lib/mock/dashboard.ts` | Dashboard metrics, pipeline stages, next actions |
| `lib/mock/resumes.ts` | Student profile, master resume, resume bullets, resume versions, AI suggestions, keyword checklist |
| `lib/mock/tailoring.ts` | Resume Tailoring Workspace session data |

Prefer imports from `@/lib/mock`. The old `@/lib/mock-data` path remains only for compatibility.

---

## 7. Design System Rules

Follow [DESIGN.md](DESIGN.md) exactly.

- Productivity tool, not AI SaaS.
- No heavy gradients, neon colors, or decorative marketing visuals.
- Use the existing dark sidebar and light gray canvas.
- Use white cards, thin borders, restrained color accents.
- Do not change the global design direction.
- Do not redesign completed screens.
- Use `lucide-react` icons.
- Use existing components from `components/app/` before creating new abstractions.
- Use CSS tokens from `app/globals.css`; do not introduce a Tailwind config.
- Keep AI reviewable and honest: use labels like "Suggested by AI", "Based on your existing resume", "Needs confirmation", and "Review before applying".
- Do not imply guaranteed outcomes.

---

## 8. Known Issues And Product Gaps

1. **No backend exists**
   - No Supabase, auth, route handlers, server actions, AI calls, file storage, scraping, PDF export, or DOCX export.

2. **Disabled placeholders remain**
   - Resume upload is disabled.
   - Application table/calendar view toggles are disabled placeholders.
   - Add application is disabled.
   - Export PDF/DOCX is disabled.
   - Notifications and Sign out are disabled.

3. **Resume versions do not have detail routes**
   - Application Detail links to `/resumes` for existing resume versions.
   - There is no `/resumes/[id]` route yet.

4. **Application Tracker is static mock data**
   - Marking a resume ready in the Tailoring Workspace updates local workspace state only.
   - It does not persist or mutate `mockApplications` after navigation.

5. **Next.js version is newer than expected**
   - Next.js is `16.2.10`.
   - `AGENTS.md` says to read `node_modules/next/dist/docs/` before writing code.
   - App Router page props use promise-based `params`/`searchParams`.

6. **Bundler notes**
   - Next 16 defaults to Turbopack.
   - In this environment, a Turbopack production build compiled but `next start` returned 500s because page bundles required a missing `chunks/ssr/[turbopack]_runtime.js`.
   - The project `build` script now uses the documented stable webpack path: `next build --webpack`.
   - Dev server has previously been more stable with:

   ```bash
   npm run dev -- --webpack --port 3002
   ```

7. **Icon library mismatch**
   - `components.json` says Phosphor, but the app uses `lucide-react`.
   - Continue using `lucide-react`.

---

## 9. Build / Lint / Typecheck Status

Current scripts in `package.json`:

```bash
npm run lint
npm run typecheck
npm run build
```

Current status after the clickable MVP route wiring:

- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run build` runs `next build --webpack`.

Production route probe after `next start --port 3004` passed:

- `/` -> `/dashboard`
- `/dashboard`
- `/jobs`
- `/jobs/j1`
- `/applications`
- `/applications/app-1`
- `/applications/app-4`
- `/applications/app-11`
- `/resumes/tailor/j11`
- `/resumes`

Note: stale duplicate generated files such as `.next/types/routes.d 2.ts` have appeared after dev/build churn. Rebuilding cleanly regenerates `.next/types`.

---

## 10. Recommended Next Work

The connected mock frontend MVP route flow is complete, and the initial
Supabase migration + client helpers exist (`supabase/migrations/`,
`lib/supabase/`). The adopted strategy is **product-led onboarding**
(PRODUCT_STRATEGY.md): guests get `/start` + a curated starter catalog and a
device-only draft profile; login is "save your progress", not a wall.

Implementation order (each phase has acceptance criteria in
PRODUCT_STRATEGY.md §3):

1. **Phase 2 — Schema delta migration:** `catalog_jobs` (anon-readable starter
   catalog, service-role-written, seeded 20–40 Canadian co-op roles) +
   `tailoring_credit_ledger` (+2 signup grant trigger, balance function).
   SQL is specified in TECHNICAL_DESIGN.md "Auth & Guest Model v2" §D.
2. **Phase 3 — Auth + hybrid routing + guest experience:** Supabase auth,
   `/login?next=&reason=`, middleware protecting ONLY private prefixes
   (`/dashboard`, `/applications`, `/resumes`, `/calendar`, `/insights`,
   `/documents`, `/settings`); public `/start` guest onboarding
   (localStorage draft `coopfinder.guest_draft.v1`, deterministic client-side
   matching, NO AI for guests); guest variants of `/jobs` and catalog job
   detail with inline gate prompts per DESIGN.md §22.
3. **Phase 4 — Jobs CRUD + guest-to-user migration** (draft migration server
   action; catalog save copies into user `job_postings`).
4. **Phase 5 — Applications CRUD** (tracking is free, no metering).
5. **Phase 6 — Master profile & resume persistence.**
6. **Phase 7 — AI parser + tailoring metered by the credit ledger**
   (1 credit per successful generation; failed generations don't burn
   credits).

Frontend-only side tasks that remain reasonable at any point: resume version
detail route, tracker table/calendar views, mobile polish.

---

## 11. Warnings For Future Agents

- **Do not rewrite the app shell.**
- **Do not redesign completed screens.**
- **Do not replace the mock-data system; extend `lib/mock/` as needed.**
- **Do not implement backend, auth, database, real AI API calls, scraping, file upload, or export unless explicitly requested.**
- **Do not remove disabled placeholder states by pretending unavailable backend actions work.**
- **Keep route flow changes scoped and verify with lint/typecheck/build before handing off.**
- **Do not blanket-protect all app routes when wiring auth.** Public: `/`,
  `/start`, `/jobs`, `/jobs/[id]`, `/login`. Private: the rest. Gate
  high-value ACTIONS (save/analyze/tailor) inline; server routes behind those
  actions must still enforce auth themselves.
- **No AI calls and no server writes in guest mode.** Guest matching is
  deterministic and client-side.
- **Use eligibility/matching language from DESIGN.md §22.4** — "N roles match
  your profile", never "you are eligible".
- **Credits are ledger-based and server-written** (`tailoring_credit_ledger`).
  Never let client code write credit rows; never burn credits on failed
  generations.
