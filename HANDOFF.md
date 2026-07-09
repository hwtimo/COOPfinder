# HANDOFF.md — COOPfinder Frontend Foundation

> **Purpose:** Hand this project to another coding agent without forcing them to rediscover the current frontend state.
>
> **Read before coding:** [DESIGN.md](DESIGN.md), [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md), [AGENTS.md](AGENTS.md), and this file.
>
> **Last updated:** 2026-07-08. Frontend MVP is almost complete. The exact next task is **Build Resume Tailoring Workspace only**.

---

## 1. Current Status

COOPfinder is a productivity-first application manager for Canadian university co-op and internship searches. The frontend is an app-shell-driven mock product. It has no backend, auth, database, real AI, file upload, scraping, or export implementation.

The UI direction is already established:

- Asana-inspired productivity app.
- Dark left sidebar.
- Light gray main canvas.
- White rounded cards.
- Thin borders.
- Calm, dense workflow UI.
- No purple-gradient AI SaaS look.

---

## 2. Screens Completed

These screens/components are built in the existing app shell and should not be redesigned:

1. **App shell**
   - `app/(app)/layout.tsx`
   - `components/app/app-sidebar.tsx`
   - `components/app/app-topbar.tsx`

2. **Dashboard**
   - `app/(app)/dashboard/page.tsx`
   - `app/(app)/dashboard/loading.tsx`
   - Uses metric cards, pipeline summary, deadlines, AI next actions, recent jobs, and resume performance mock data.

3. **Jobs page**
   - `app/(app)/jobs/page.tsx`
   - `app/(app)/jobs/jobs-page-client.tsx`
   - `app/(app)/jobs/loading.tsx`
   - Includes table view, search, filters, status badges, and local mock Add Job modal.

4. **Job Detail page**
   - `app/(app)/jobs/[id]/page.tsx`
   - `app/(app)/jobs/[id]/loading.tsx`
   - Includes job summary, responsibilities, requirements, keywords, estimated match, missing keywords, status, and trust labels.

5. **Application Tracker**
   - `app/(app)/applications/page.tsx`
   - `app/(app)/applications/loading.tsx`
   - Includes compact clickable kanban cards, column counts, empty-column states, table/calendar placeholders, and add-application placeholder.

6. **Application Detail**
   - Current codebase does **not** contain a standalone `app/(app)/applications/[id]/page.tsx` route.
   - Application detail-style mock data exists in `lib/mock/applications.ts` as `mockApplicationTimeline`.
   - The current tracker cards link to related job detail pages. Do not add a dedicated Application Detail screen unless the user explicitly reopens that scope. The exact next task remains Resume Tailoring Workspace only.

---

## 3. Screens Not Completed

Only one frontend feature screen remains:

- **Resume Tailoring Workspace**

Build this later as the 3-panel core workflow from DESIGN.md:

- Original resume / current version.
- AI suggestions with accept/reject/edit controls.
- Job requirements, missing keywords, and keyword checklist.

Keep it mock-only. Do not implement backend, auth, database, AI API, scraping, file upload, or export.

---

## 4. Current Routes

| Route | File | Status |
|---|---|---|
| `/` | `app/page.tsx` | Redirects to `/dashboard` |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Complete mock screen |
| `/jobs` | `app/(app)/jobs/page.tsx` + `jobs-page-client.tsx` | Complete mock screen |
| `/jobs/[id]` | `app/(app)/jobs/[id]/page.tsx` | Complete mock job detail |
| `/applications` | `app/(app)/applications/page.tsx` | Complete mock tracker |
| `/resumes` | `app/(app)/resumes/page.tsx` | Placeholder; use for Resume Tailoring Workspace if desired |
| `/calendar` | `app/(app)/calendar/page.tsx` | Placeholder |
| `/insights` | `app/(app)/insights/page.tsx` | Placeholder |
| `/documents` | `app/(app)/documents/page.tsx` | Placeholder |
| `/settings` | `app/(app)/settings/page.tsx` | Static mock profile |

No standalone `/applications/[id]` route exists in the current codebase.

---

## 5. Main Components

Custom app components live in `components/app/`:

| Component | Purpose |
|---|---|
| `AppSidebar` | Persistent dark left navigation, active state, saved views, mock user footer |
| `AppTopbar` | Sticky top bar with breadcrumb, search placeholder, Add Job placeholder, notifications, avatar menu |
| `PageHeader` | Standard page title, description, and actions row |
| `MetricCard` | Dashboard metric card with next-action link |
| `StatusBadge` | Application status pill with dot and label |
| `DeadlineBadge` | Deadline urgency pill |
| `EmptyState` | Dashed empty-state card with optional action |
| `CardSection` | White bordered card section with header and content area |

shadcn/ui primitives live in `components/ui/`. Do not hand-edit generated primitives unless a local bug requires it.

---

## 6. Mock Data Files

Mock data has been split into reusable domain files under `lib/mock/`.

| File | Contents |
|---|---|
| `lib/mock/index.ts` | Barrel export for all mock data |
| `lib/mock-data.ts` | Compatibility re-export from `./mock` |
| `lib/mock/types.ts` | Shared mock types |
| `lib/mock/dates.ts` | `daysUntil`, `formatDeadline` |
| `lib/mock/companies.ts` | Company fixtures |
| `lib/mock/jobs.ts` | Jobs, job analyses, job requirements |
| `lib/mock/applications.ts` | Application tracker columns, applications, timeline mock data |
| `lib/mock/dashboard.ts` | Dashboard metrics, pipeline stages, next actions |
| `lib/mock/resumes.ts` | Student profile, master resume, resume bullets, resume versions, AI suggestions, keyword checklist |

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
- Keep AI reviewable and honest: use labels like “Suggested by AI”, “Based on your existing resume”, “Needs confirmation”, and “Review before applying”.
- Do not imply guaranteed outcomes.

---

## 8. Known Issues

1. **Application Detail route mismatch**
   - User-facing scope has referred to Application Detail as complete, but the current codebase has no standalone `/applications/[id]` route.
   - Existing tracker cards link to related Job Detail pages.
   - `mockApplicationTimeline` exists for future use, but do not add the screen unless explicitly asked.

2. **Next.js version is newer than expected**
   - Next.js is `16.2.10`.
   - `AGENTS.md` says to read `node_modules/next/dist/docs/` before writing code.
   - App Router page props use promise-based `params`/`searchParams`.

3. **Turbopack dev instability**
   - Dev server previously crashed with `RangeError: Map maximum size exceeded`.
   - If `localhost:3000` is stale, use:

   ```bash
   npm run dev -- --webpack --port 3002
   ```

4. **Icon library mismatch**
   - `components.json` says Phosphor, but the app uses `lucide-react`.
   - Continue using `lucide-react`.

5. **Mock date is fixed**
   - Deadline urgency is calculated relative to `2026-07-08` in `lib/mock/dates.ts`.

6. **No backend exists**
   - No Supabase, auth, route handlers, server actions, AI calls, file storage, scraping, PDF export, or DOCX export.

---

## 9. Build / Lint / Typecheck Status

Current scripts in `package.json`:

```bash
npm run lint
npm run typecheck
npm run build
```

Most recent status after mock-data extraction:

- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run build` passes.

Note: stale duplicate generated files such as `.next/types/routes.d 2.ts` have appeared after dev/build churn. Running `npm run build` usually regenerates `.next/types` cleanly.

---

## 10. Exact Next Task

Build **Resume Tailoring Workspace only**.

Suggested location:

- Use `/resumes`, replacing the placeholder, or
- Add `/resumes/tailor` if the user explicitly prefers a separate route.

Use existing mock data from `lib/mock/resumes.ts` and `lib/mock/jobs.ts`.

Expected workspace:

- Original resume / resume version panel.
- AI suggestions panel with accept/reject/edit controls.
- Job requirements / keyword checklist panel.
- Trust labels and review-before-applying language.
- Loading skeleton if a route-level loading state is added.

Do not build backend behavior. Any accept/reject/edit behavior should be local mock UI only.

---

## 11. Warnings For Future Agents

- **Do not rewrite the app shell.**
- **Do not redesign completed screens.**
- **Do not implement backend before frontend MVP is complete.**
- **Do not add auth, database, real AI API calls, scraping, file upload, or export.**
- **Do not refactor unrelated UI while building Resume Tailoring Workspace.**
- **Do not replace the mock-data system; extend `lib/mock/` as needed.**

Keep changes scoped, follow the existing design language, and verify with lint/typecheck/build before handing off.
