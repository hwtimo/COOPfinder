# HANDOFF.md — InternshipBC Continuation Handoff

> **Purpose:** Let the next coding agent continue without rediscovering the
> current state. This reflects the codebase as of **2026-07-28**.
>
> **Read before coding:** [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) (r2 —
> current), [DESIGN.md](DESIGN.md) (esp. §22–24),
> [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) (esp. the as-built notes),
> [CHATGPT_DIRECTOR_CONTEXT.md](CHATGPT_DIRECTOR_CONTEXT.md),
> [CODEX_SESSION_LOG.md](CODEX_SESSION_LOG.md), [AGENTS.md](AGENTS.md), and
> this file.
>
> **Product direction (unchanged):** Canadian co-op application command
> center. "Found a role? Paste the link. InternshipBC extracts the
> requirements, compares them to your profile, helps you tailor a reviewed
> resume, exports a clean PDF, and sends you back to the original site to
> apply yourself."
>
> **As built today:** saving a URL stores only its normalized link. Automatic
> retrieval is not implemented; the owner must paste the job description
> before the existing Analyze path becomes available.
>
> **R1-1 authentication state:** Implementation commit
> `8849ad202824eb0338ed1746125262e8eb5009f2` makes
> `https://internshipbc.dev` the single production auth origin, adds primary
> email/password signup and login, forgot/reset password flows, and retains
> magic-link login as the secondary method. Supabase SSR cookies remain the
> session store; callback and proxy refresh responses now preserve private
> no-store headers. The Supabase Site URL is canonical and its redirect allow
> list contains only the canonical callback plus localhost development; the
> obsolete Vercel callback was removed. The commits are deployed. A controlled
> production account completed password signup and confirmation, password
> login/logout, forgot/reset password, old/new password rejection and success,
> secondary magic-link login, immediate browser restart, and direct canonical
> dashboard reloads. A later-calendar-day direct `/dashboard` visit and reload
> remained server-authenticated without another sign-in. Supabase Auth's
> minimum password length is aligned with the application at 8 characters.
>
> **R1-1 reset-password follow-up:** Production safely logged the reproduced
> rejection as Supabase Auth code `same_password` with HTTP 422, but the page
> previously collapsed every update failure into the expired/unavailable copy.
> Implementation commit
> `cb1681b5598d3479d7fbbd1904f982d0394357c6` now maps only the validated
> `same_password` code to “Choose a different password.” without signing out or
> consuming the valid reset session; truly unavailable/expired states retain
> their existing copy. Focused tests and repository validation passed. The fix
> is deployed and production-verified: current-password reuse shows the
> accurate rejection, a different password succeeds, the previous password is
> rejected, and the replacement password signs in successfully.
>
> **R1-2 Google Sign-In state:** Implementation commit
> `e6730df8c62928c90b5242b3babc1118e2059d4d` places Google first on `/login`
> when the existing server-only feature flag is enabled, followed by
> email/password and then magic link. The existing canonical callback, safe
> `next` handling, Supabase SSR session persistence, and guest-draft handoff
> remain unchanged. A production Google consent screen and Web OAuth client
> were configured with
> `https://jxkpdllueidclqwpxhxp.supabase.co/auth/v1/callback`, and the Google
> provider is enabled in Supabase. Client credentials were entered directly
> in the dashboards and are not stored in the repository. Focused auth tests,
> lint, typecheck, the production webpack build, and diff checks passed.
> Vercel Production now sets `GOOGLE_AUTH_ENABLED=true`, and revision
> `22ca4687bdf7f633da842f23bcc32b21a81022b2` was redeployed without changing
> application code. Production verification with a Google account not
> previously used for InternshipBC confirmed Google first, password second,
> magic link third, successful signup, canonical `internshipbc.dev` callback
> and dashboard landing, reload persistence, and direct authenticated `/jobs`
> navigation. ROADMAP R1-2 is complete and checked.
>
> **R1-3A app-shell identity state:** Implementation commit
> `9323dad4d0b93a7591f1d8d1f5c77f337efcd370` removes `currentUser` and all
> fabricated name, program, term, initials, and profile fallback values from
> the production app shell. The force-dynamic server layout now authenticates
> through the request-bound Supabase client, reads only the authenticated
> owner's existing `profiles` identity fields, and passes a serializable shell
> identity to the existing client sidebar and topbar. Missing optional profile
> values use the authenticated email/email initial or neutral `Account` and
> `Workspace` labels. Navigation, logout, guest-draft handoff, and layout
> structure are unchanged. Focused tests, the shell grep guard, lint,
> typecheck, production build, and diff checks passed. This is only R1-3A;
> ROADMAP R1-3 remains incomplete and unchecked while other production screens
> still use mock fixtures.
>
> **R1-3B Dashboard state:** Implementation commit
> `43ef738b3b3b9fcbd77232be89fc25882a785e4d` removes all Dashboard mock
> imports and fabricated identity, jobs, applications, deadlines, metrics,
> percentages, recommendations, resume performance, and next actions. The
> force-dynamic page authenticates normally and uses a server-only,
> owner-scoped query returning only private job display summaries and
> application statuses. Counts, pipeline state, recent ordering, and upcoming
> deadlines are derived deterministically from those persisted rows. A new
> account sees one honest `Add first job` CTA; unconfigured or failed data
> access shows an unavailable state with no mock fallback. Focused tests,
> scoped grep, lint, typecheck, production build, and diff checks passed.
> ROADMAP R1-3 remains incomplete and unchecked because other production
> screens still use mock fixtures.
>
> **R1-3C Resumes hub state:** Implementation commit
> `c8cdfbfd72f08a11fac6d88fbd8022fb9c611725` removes the remaining
> mock-build copy and all fabricated resume-version/performance/activity
> assumptions from the production `/resumes` hub. The force-dynamic page uses
> a server-only, owner-scoped `resume_versions` summary query that selects only
> safe display fields plus the linked private job title; existing immutable
> version and tailoring routes are unchanged. Real saved versions link to
> their existing review route. Empty, unconfigured, malformed, and failed-load
> states never substitute mock data. The real Master Profile entry point
> remains, while upload is honestly disabled as unimplemented. Focused tests,
> scoped grep, lint, typecheck, production webpack build, and diff checks
> passed. ROADMAP R1-3 remains incomplete and unchecked while other production
> screens still use mock fixtures.
>
> **R1-3D placeholder-route state:** Implementation commit
> `7e484bf0a43a5710fbd0561b56ac6ac3f4090f4c` removes fabricated or
> forward-looking event, analytics, performance, document-storage, and
> activity assumptions from the production `/calendar`, `/insights`, and
> `/documents` routes. Each route remains an intentionally unimplemented,
> honest placeholder with exactly one existing-product CTA: Calendar to
> Applications, Insights to My Jobs, and Documents to Resumes. No data query,
> persistence, upload, analytics, calendar, or document-management behavior
> was added, and no route falls back to mock data. Focused tests passed 4/4;
> scoped grep, lint, typecheck, production webpack build, and diff checks
> passed. ROADMAP R1-3 remains incomplete and unchecked while other
> production screens still use mock fixtures.
>
> **R1-3E Settings state:** Implementation commit
> `d4c88e5f5fa3f0d9f589d0d97414894a071a5cbb` removes the production
> Settings route's `currentUser` mock dependency and fabricated identity,
> school, program, term, email, avatar, and preference assumptions. A
> server-only helper authenticates through the request-bound Supabase client,
> reads only the owner's `profiles` display fields, and returns a minimal
> read-only account DTO. Missing optional fields render neutral values;
> authentication redirects normally, and unavailable data never falls back
> to fixtures. Settings editing remains explicitly unavailable. Focused tests
> passed 6/6; scoped grep, lint, typecheck, production webpack build, and diff
> checks passed. ROADMAP R1-3 remains incomplete and unchecked while other
> production screens still use mock fixtures.
>
> **R1-3F production mock audit state:** Implementation commit
> `5954e7f5154bab472e457438c033a9d4c4ea3971` completes the repository-wide
> production route/component mock audit. It removes the legacy mock tailoring
> workspace and mock-only suggestion/trust components; non-UUID legacy IDs now
> fail closed while persisted UUID jobs retain the existing owner-scoped
> preflight, credit display, and generation path. The public board no longer
> substitutes starter fixtures when Supabase is unavailable, and `/start`
> ranks only real reviewed board rows supplied by its server page. The shared
> status badge now uses the production job-status contract, and the final
> mock-build tooltip was neutralized. A cheap automated guard scans production
> TypeScript/TSX sources and rejects `lib/mock` imports. Focused tests passed
> 16/16; repo-wide production import/fixture grep, lint, typecheck, production
> webpack build, and diff checks passed. No production `lib/mock` import
> remains. ROADMAP R1-3 remains incomplete and unchecked pending deployment
> and fresh-account production verification.
>
> **R1-3 production verification:** The complete R1-3A through R1-3F series
> was pushed and Vercel reported a successful production deployment for
> revision `bf7ac11a8ffdeda86ea3f122c8bc21b89408a9df`. A brand-new empty
> production account showed only its real email identity and neutral missing
> profile values. Dashboard and Resumes rendered honest empty states;
> Calendar, Insights, and Documents rendered honest unavailable placeholders;
> `/start` and `/board` used the persisted reviewed public-board rows without
> fixture fallback; and `/resumes/tailor/j11` returned the safe 404 path.
> No Maya Chen or known fixture copy appeared in the checked production
> routes. ROADMAP R1-3 is complete.
>
> **R1-4A repository-facing branding state:** Implementation commit
> `98a0d8c5d4fd44afbb90c1d8fc86378da78215c8` replaces visible legacy product
> naming with InternshipBC across production metadata, login and reset
> surfaces, the app shell, onboarding, private-job controls, and public-board
> copy. Current README, strategy, design, technical-design, roadmap, director,
> and handoff text use InternshipBC. A focused automated guard rejects legacy
> brand strings in user-facing production code. Technical package identifiers,
> stable local-storage keys, internal URL sentinels, repository paths,
> migrations, and historical session records remain unchanged. Focused tests,
> the brand audit, lint, typecheck, production webpack build, and diff checks
> passed. ROADMAP R1-4 remains incomplete and unchecked pending external
> auth-email branding and production verification.
>
> **R1-4 production and external-auth verification:** Commits
> `98a0d8c5d4fd44afbb90c1d8fc86378da78215c8` and
> `bbe8f065eb0994756d1e14ef0e7b1762f798b101` are deployed to
> `internshipbc.dev`. Production metadata, login and password-reset screens,
> the authenticated sidebar/topbar, onboarding, and the public board display
> InternshipBC with no visible legacy brand. Supabase confirmation,
> password-reset, and magic-link templates now use the InternshipBC sender
> display name, subjects, and visible body copy while preserving their
> existing template variables and returning to `internshipbc.dev`. The live
> Google OAuth client is configured with the InternshipBC consent-screen app
> name. One email of each type was delivered and inspected without exposing
> credentials, tokens, or full authentication links. ROADMAP R1-4 is complete.
>
> **R1-5A public legal pages:** Implementation commit
> `a1ecb62b08fa9cbf630e93d9540e678326420b63` adds public `/privacy` and
> `/terms` pages plus minimal links from login and public onboarding. The
> Privacy Policy reflects the implemented Supabase storage and owner-scoping,
> names the exact job-analysis and tailoring content sent to OpenAI, records
> `store:false`, distinguishes OpenAI's default no-training-without-opt-in
> policy from its default abuse-monitoring retention, and states that
> self-serve account deletion is not yet available. The Terms keep application
> submission and content accuracy with the user and make no eligibility,
> interview, offer, or hiring guarantee. Focused tests passed 12/12; lint,
> typecheck, production webpack build, logged-out route checks, and both diff
> checks passed. ROADMAP R1-5 remains incomplete and unchecked pending the
> separately scoped account-deletion work.
>
> **R1-5B self-serve account deletion:** Implementation commit
> `bf872f0b7294cf816c3b32a31913a90baf324276` adds an authenticated Settings
> danger-zone control that requires the exact destructive confirmation
> `DELETE`. The server action derives the
> target only from the request-bound Supabase session, crosses the existing
> server-only admin boundary for a hard Auth user deletion, clears the local
> session, and redirects to public `/start`. Repository inspection found no
> Supabase Storage buckets or object paths, so the explicit storage-cleanup
> boundary performs no guessed bucket operation. All private user-owned tables
> reference `auth.users` with `ON DELETE CASCADE`; only shared company creator
> and moderated public-board submitter attribution use `SET NULL`. Failures
> return fixed sanitized states without claiming deletion. The Privacy Policy
> now points authenticated users to Settings. Focused Settings/legal tests
> passed 21/21; lint, typecheck, production webpack build, and both diff checks
> passed. ROADMAP R1-5 remains incomplete and unchecked pending production
> account-deletion verification.
>
> **R1-5 production account-deletion verification:** Production initially
> rejected the Settings Server Action module before authentication because its
> file-level `"use server"` module exported a runtime initial-state object.
> Fix commit `b695d637881d633b80404baf4867919c73c2cbfe` moves that object to the
> client form while preserving session-derived identity, the server-only admin
> boundary, sanitized failures, and database cascades. The deployed fix was
> verified with the existing disposable account: exact `DELETE` confirmation
> redirected to `/start`, private routes required login, the Auth user and all
> schema-derived owned rows were removed, Storage remained empty, and the
> deleted credentials were rejected. Focused Settings tests passed 17/17;
> lint, typecheck, production webpack build, and both diff checks passed.
> ROADMAP R1-5 is complete.
>
> **R1-6 privacy-safe monitoring:** Foundation commit
> `11128701f575ca9d568c538976a96b9f649757c2` adds pinned
> `@sentry/nextjs` client, Node, and Edge initialization plus Next.js
> `onRequestError` and a global client error boundary. Monitoring remains
> disabled unless `NEXT_PUBLIC_SENTRY_DSN` is configured. The SDK sends no
> replay, profiles, traces, logs, console breadcrumbs, request data, headers,
> cookies, query strings, bodies, user identity, local variables, source
> context, or AI inputs/outputs. A final outbound allowlist retains only
> normalized route/runtime/status metadata, exception type, and sanitized code
> locations. Focused tests passed 5/5; lint, typecheck, production webpack
> build, and both diff checks passed. Production verification confirmed the
> existing `onRequestError` hook captures a harmless Server Action failure, so
> no extra per-action instrumentation was needed. Fix commit
> `26b0cc597e7999c13dc02729fb437d3fe2fd803b` removes the invalid top-level
> `type: "error"` value (Sentry error events require an undefined type), with a
> regression assertion. Vercel deployed that clean revision successfully;
> Sentry showed normalized route/runtime/status, exception type, and sanitized
> stack locations without the synthetic email, token, request content, job,
> profile, resume, or prompt sentinels used by the local canary. No permanent
> trigger or test route remains. ROADMAP R1-6 is complete.
>
> **R1-7 `/jobs` blocker fix:** Implementation commit
> `d8c28ebdce871da47662cfa26d158c698502b723` removes the legacy Match score
> filter type, state, predicate, and visible `80%+`, `70%+`, and `50%+`
> threshold options from the private Jobs page while preserving search and
> persisted role, location, term, work-mode, co-op, authorization, and
> deadline filters. The explainable Profile Match flow is unchanged. Focused
> Jobs tests passed 10/10; production-code grep, lint, typecheck, production
> webpack build, and both diff checks passed. Vercel deployed the exact commit
> successfully, and a brand-new empty production account confirmed `/jobs`
> exposes no Match score or percentage-threshold filter. The disposable
> account was deleted afterward. ROADMAP R1-7 remains incomplete and unchecked
> pending the rest of the full-flow exit gate.
>
> **R1-7 Profile Match percentage blocker fix:** Implementation commit
> `0446f8d837a3b8107a6c37dbbd386b0731aa895d` removes the user-facing coverage
> percentage suffix from every explainable Profile Match requirement group
> while preserving the deterministic matched/not-evidenced counts and the
> matcher result contract. Focused Profile Match and pure matcher tests passed
> 44/44; the scoped production-source grep found no user-facing coverage
> percentage, and lint, typecheck, production webpack build, and both diff
> checks passed. Vercel deployed the exact commit successfully. A disposable
> production account with a synthetic analyzed job confirmed the required and
> preferred groups render `1 of 2 found` and `0 of 1 found` with no percentage
> or coverage label, including the accessible region text. The disposable
> account was deleted afterward. ROADMAP R1-7 remains incomplete and unchecked
> pending the rest of the full-flow exit gate.
>
> **R1-7 production exit gate:** Production revision
> `a1603878dab5e4cf6b288be89dec7feb084dc8bd` completed the full normal-UI flow
> with a fresh account: signup and dashboard; confirmed Master Profile
> evidence and an approved resume fragment; URL-only job save; owner manual-JD
> transition; one successful job analysis; counts-only deterministic Profile
> Match; one successful tailored-resume generation using only approved and
> confirmed evidence; persisted immutable version and Print / Save as PDF
> control; application creation; persisted status change and timeline; and
> self-serve account deletion. No URL fetch or auto-apply was attempted. The
> checked surfaces contained no mock content, old branding, test copy,
> fabricated match metrics, eligibility claims, or dead end. Deletion
> redirected to `/start`, revoked private-route access, removed the Auth user,
> and returned every schema-derived owned-row category to zero. ROADMAP R1-7
> is complete and checked. Do not redo R1.
>
> **Repository evidence reviewed through:** URL/manual-fallback implementation
> commit `fc9721d115fb3c3cb71e3093fe382d6dd76ca80a`, including parser-credit
> integration log commit `202556f85cfd8b856aea4ceb32a112675703fa0d`, reservation-table
> privilege hardening commit `2276ef39a1a6dfc128bfe8d4677c7385302fbab8`
> and Analyze integration commit
> `5744ba72a3dae9008ff9ff95d0d641c0b0476caa`. A validated URL/manual-fallback
> session-log draft was the only pre-existing worktree change before this
> documentation-only synchronization.

---

## 1. Completed phases (do NOT redo these)

1. **Strategy revision 2** — public moderated `/board`, private authed
   `/jobs`, product-led `/start`, public/private job-data separation.
2. **Schema Delta v3** — `202607090003_board_intake_export_v3.sql`:
   `board_jobs` (renamed from `catalog_jobs`) with moderation states,
   approved/active/unexpired public reads, submitter-own-row reads,
   `job_intake_events`, `job_postings` intake columns, `profiles.is_admin`.
3. **`/start` v2** — guest URL/JD stash into
   `localStorage["coopfinder.guest_draft.v1"]` (multiple stashed jobs),
   lightweight guest profile, deterministic starter match preview,
   value-first login gate. No guest server writes, no fetching, no AI.
4. **Public board** — `/board` + `/board/[id]` with public-safe queries,
   filters, loading/empty/error/not-found states, guest match notes,
   original-source link-outs; sidebar "Job board" (public) vs "My jobs"
   (private); guest `/jobs` → `/board` redirect.
5. **Public-page, authenticated-mutation board submission** — `/board/submit` +
   `202607120001_atomic_board_submission.sql`:
   `submit_board_job_with_private_copy()` atomically creates the private
   `job_postings` row and the `pending_review` `board_jobs` candidate
   (identity from `auth.uid()`, forced `pending_review`/`is_active=false`,
   review fields not caller-suppliable, `SECURITY DEFINER` + empty
   `search_path`, authenticated-only execute; the older board-only RPC is
   revoked). Guests can render the page and see an honest sign-in-required
   state, but never private history; the server action remains the auth gate.
   Submitter status labels: Pending review / On the board / Not added /
   Archived. Honest Supabase-disabled states. No moderation dashboard exists
   (founder moderates in Supabase Studio).
6. **Private saved-jobs CRUD** — authenticated `/jobs` + `/jobs/[id]`:
   create/list/read/edit/delete over persisted rows, search/filters, private
   raw-JD storage, private not-found behavior, approved-board→private saving
   (`intake_source='board_save'`, `board_job_id` set), duplicate board-saves
   prevented by `job_postings_user_board_job_unique_idx`
   (`202607130001_unique_private_board_saves.sql`), honest "Analysis not
   generated yet" state when no persisted extraction exists, and tailoring
   unavailable because production tailoring is not implemented. Eligible
   pasted-text analysis is described in phase 9.
   Production Jobs pages no longer show mock jobs as the user's data.
7. **Master Profile persistence + guest-draft import** —
   `202607130002_master_profile_guest_import.sql` (details in §3–4 below and
   TECHNICAL_DESIGN.md §I–J), three guest-import repairs through
   `202607130005`, and the `save_master_profile()` repair
   `202607130006_fix_save_master_profile_coalesce.sql`.
8. **Persisted Applications CRUD** — migrations `007`–`014`, authenticated
   `/applications` and `/applications/[id]`, one application per caller-owned
   private saved job, seven canonical statuses, atomic creation with one
   initial event, persisted private timeline, atomic status/notes/deadline/
   follow-up mutations, and authenticated deletion. Deletion cascades only the
   application timeline, preserves the linked job/company, makes that job
   eligible for recreation, and creates no deletion event. Do not redo this
   phase.
9. **Private pasted-text parser pipeline** — canonical versioned extraction
   schema, deterministic confidence, server-only OpenAI Responses API,
   centralized `OPENAI_MODEL_LUNA` production routing, authenticated owned-job
   lookup, atomic extraction persistence (`015`), extraction-to-persistence
   orchestration, authenticated Jobs server action, persisted Job Detail
   analysis display, and Analyze / Analyze Again controls for eligible
   `intake_source='pasted_text'` jobs. No live authenticated OpenAI success has
   been proven; do not manufacture that verification claim.
10. **Parser-analysis credit database foundation and ACL hardening** —
    migration `016` adds
    atomic authenticated reservation/finalization with lifetime successful
    capacity 2 and rolling 24-hour attempt limit 3; migration `017` adds
    separate append-only reserved/consumed/refunded events; migration `018`
    removes authenticated direct INSERT/UPDATE/DELETE reservation-table
    privileges while preserving own-row SELECT through RLS and authenticated
    reserve/finalize RPC execution.
11. **Parser-credit Analyze integration** — Analyze and Analyze Again share the
    existing authenticated server action. It reserves before provider work,
    proceeds only after `reserved`, and finalizes successful persistence as
    consumed or post-reservation failure as refunded.
12. **Authenticated URL-only private-job intake with manual pasted-text
    fallback** — HTTP/HTTPS URLs are normalized and stored as `pasted_url`
    without fabricated `raw_text`. No server-side fetch, DNS lookup, HTML
    parsing, crawling, redirect processing, scraping, or job-board adapter
    exists. Only the authenticated owner can submit valid manual text to the
    same job; one conditional update writes `raw_text` and changes
    `intake_source` to `pasted_text` together while preserving `source_url` and
    existing extraction. The unchanged credit-enforced Analyze path then
    becomes available, and no duplicate job is created.
13. **Structured matching and production tailoring milestone** — extended job
    requirements and candidate evidence feed deterministic Profile Match;
    only approved resume fragments and structured evidence enter the
    reference-only tailoring contract. Tailoring preflight, one-request
    provider generation, reservation/refund/replay, atomic credit finalization,
    immutable tailored-resume persistence, owner-only review, and deterministic
    Print/PDF presentation are implemented. No raw profile or job prose is
    provider-authored or copied into generated versions.

14. **Canonical password authentication implementation (R1-1, complete)** -
    production auth URL construction cannot select a Vercel
    deployment host; localhost remains available only in development.
    Email/password signup and login are primary on `/login`, magic link is
    secondary, and `/forgot-password` plus `/reset-password` implement a
    non-enumerating PKCE reset/update flow. Safe `next` and known `reason`
    values are preserved. Callback and Supabase proxy refresh responses carry
    no-store headers. Automated verification and the complete production
    acceptance flow passed, including reset, secondary magic link, browser
    restart, and later-calendar-day server-authenticated dashboard reload.

Also in place since earlier phases: Supabase auth (`/login`,
`/auth/callback`, `/auth/sign-out`), `proxy.ts` hybrid route protection,
guest/authed shell states, and `tailoring_credit_ledger` with +2 signup grant.
Production tailoring now consumes exactly one credit only in the same atomic
transaction that persists a complete immutable resume version.

## 2. Current routes (as built)

Public: `/` (authed→`/dashboard`, guest→`/start`), `/start`, `/board`,
`/board/[id]`, `/board/submit` (page is public; submitting requires auth),
`/login`, `/forgot-password`, `/reset-password`, `/auth/callback`,
`/auth/sign-out`.

Private (via `proxy.ts`): `/dashboard`, `/jobs`, `/jobs/[id]`,
`/applications`, `/applications/[id]`, `/resumes`, `/resumes/master`,
`/resumes/tailor/[jobId]`, `/calendar`, `/insights`, `/documents`,
`/settings`. Guests hitting `/jobs` are redirected to `/board`.

Persistence status by screen: `/board*`, `/jobs*` (including URL-only manual-
paste preparation, pasted-text analysis, and Profile Match), `/applications*`,
`/resumes/master`, persisted UUID `/resumes/tailor/[jobId]`, and
`/resumes/versions/[versionId]` use **real Supabase data**. Dashboard, Resumes
hub, the legacy recognized mock Tailoring Workspace, Calendar, Insights,
Documents, and Settings still render **mock/local data**.

## 3. Master Profile persistence (as built)

- `/resumes/master` loads and saves authenticated Supabase data through the
  `save_master_profile(p_profile, p_skills, p_entries)` RPC — one transaction
  covering profile scalars, skills (stored at `master_profiles.data.skills`),
  and ordered `master_profile_entries` (delete-and-reinsert, `sort_order`
  preserved). Server re-validates all payloads. No AI call. Private data only.
- Migration 006 removes invalid `pg_catalog.` qualification from five
  `COALESCE` and five `NULLIF` expressions while preserving the RPC signature,
  return type, `SECURITY DEFINER`, empty `search_path`, and authenticated-only
  execution. Live tests passed initial save, replacement, empty-array clearing,
  zero-based evidence ordering, confirmation states, fresh evidence IDs,
  caller ownership, application-shaped payloads, and complete rollback after
  a deterministic later invalid-entry failure.
- **No mock student initializes the production page.** Supabase-unconfigured
  builds show an honest disabled EmptyState; load errors state that no mock
  or cross-user data was substituted.
- **Evidence confirmation is a trust boundary:** user-authored entries can be
  confirmed; editing a confirmed entry resets it to unconfirmed; the user
  must explicitly reconfirm. Future AI must only cite confirmed evidence and
  must never mark AI-generated content as confirmed.
- Not implemented (do not claim): resume upload, resume-version persistence,
  AI rewriting, tailoring, export.

## 4. Guest-draft import (as built)

- `components/app/guest-draft-import-handoff.tsx` (mounted in
  `app/(app)/layout.tsx` for authed users) detects
  `localStorage["coopfinder.guest_draft.v1"]`, normalizes it
  (`lib/guest-draft/normalize.ts`), and calls the
  `import_guest_draft(p_draft, p_mode)` RPC. Malformed JSON / invalid URLs →
  **no server write**, draft stays in localStorage, warning notice shown.
  Browser-supplied IDs/hashes are not trusted; the server re-validates.
- **Empty account (`mode='auto'`):** automatic import — profile scalars,
  skills, target roles, guest-authored evidence (imported `confirmed = true`
  because the user typed it), stashed URL jobs (`source_url`,
  `intake_source='pasted_url'`) and pasted-text jobs (`raw_text`,
  `intake_source='pasted_text'`). The guest-import path itself performs no
  fetch, scraping, or AI parsing and invents no metadata; an authenticated
  user may analyze the imported pasted-text job later. Title-less imports use
  the honest schema-required
  placeholder **`Imported job - add title`** — never present it as extracted
  information or as analyzed.
- **Existing account:** RPC returns `needs_confirmation`; the client shows an
  explicit **non-destructive merge prompt**. Merge preserves populated scalar
  fields, fills safe empty ones, unions arrays case-insensitively, skips
  duplicate skills/roles/evidence/jobs, deletes nothing, silently overwrites
  nothing. It is not a general-purpose merge editor.
- **Idempotency/atomicity:** server-computed canonical SHA-256 draft hash;
  `guest_draft_imports` ledger with `unique (user_id, draft_hash)`;
  per-user advisory transaction lock; all writes atomic with full rollback on
  failure; repeats return `already_imported`. Refreshes, login-callback
  retries, and concurrent requests cannot duplicate imports.
- **Clearing protocol:** the draft is removed from localStorage **only** on a
  complete matching `imported` or `already_imported` result. It remains
  stored on validation failure, invalid URL, Supabase unavailability, RPC
  failure, rollback, non-matching response, or incomplete import.
- Security: both RPCs are `SECURITY DEFINER` with empty `search_path`,
  execute revoked from `PUBLIC`/`anon`, granted only to `authenticated`,
  ownership from `auth.uid()`. Ledger rows are select-own only with no client
  write policy.
- Live verification passed one normal authenticated import, exact sequential
  repeat, canonical object-key-order normalization, real concurrent duplicate
  calls through independent sessions (exactly one `imported`, one
  `already_imported`), advisory-lock/ledger behavior, existing-account `auto`
  no-write confirmation, and explicit non-destructive `merge`. Duplicate
  evidence/jobs were skipped, guest evidence persisted confirmed, raw pasted
  JD stayed private, and all fixtures were cleaned up.
- Mid-transaction guest-import rollback is **conditionally complete**, not a
  passed behavioral test. All caller-controlled constraint-sensitive input is
  validated before the first write; subsequent ownership, IDs, title, intake
  source, and ledger values are derived or fixed. No safe deterministic
  caller-controlled post-write failure exists, and production behavior was not
  changed merely to manufacture one. It did not block the completed
  Applications CRUD phase.

## 4a. Applications CRUD (as built)

- `/applications` reads only the authenticated user's persisted applications
  and caller-owned saved jobs. The board view is real; Table and Calendar modes
  remain disabled placeholders and drag-and-drop is not implemented.
- Add Application lists only untracked eligible saved jobs and calls
  `create_application_from_job(uuid)`. The RPC owns identity through
  `auth.uid()`, serializes retries, enforces one application per user/job, and
  creates exactly one `application_created` event.
- `/applications/[id]` reads the owned application, linked private job, and
  persisted timeline. Foreign and nonexistent IDs share the private not-found
  state; Supabase-disabled builds show honest unavailable states without mock
  substitution.
- `update_application_status`, `update_application_notes`,
  `update_application_deadline`, and `update_application_follow_up` lock the
  owned row, distinguish real changes from no-ops, and append one canonical
  minimal event for each real change. Note text never enters timeline metadata.
- `delete_application(uuid)` deletes one caller-owned application and relies on
  the existing timeline `ON DELETE CASCADE`; the private job FK boundary
  preserves the job and company. The deleted job becomes eligible for atomic
  application creation again. No deletion event is written.
- All mutation RPCs are `SECURITY DEFINER` with empty `search_path`, derive
  ownership from `auth.uid()`, revoke execute from `PUBLIC`/`anon`, and grant
  execute only to `authenticated`. Production actions use the normal server
  Supabase client, never a service-role client.
- Not implemented: tracker drag-and-drop, tracker Table/Calendar modes, resume
  attachment, arbitrary user-created timeline events, recruiter contacts,
  notification automation, or Calendar integration.

## 5. Migrations (chronological)

1. `202607090001_initial_mvp_schema.sql`
2. `202607090002_product_led_onboarding_delta.sql`
3. `202607090003_board_intake_export_v3.sql`
4. `202607120001_atomic_board_submission.sql`
5. `202607130001_unique_private_board_saves.sql`
6. `202607130002_master_profile_guest_import.sql`
7. `202607130003_fix_import_guest_draft_coalesce.sql`
8. `202607130004_fix_import_guest_draft_nullif.sql`
9. `202607130005_fix_import_guest_draft_hash_ambiguity.sql`
10. `202607130006_fix_save_master_profile_coalesce.sql`
11. `202607130007_applications_crud_foundation.sql`
12. `202607130008_atomic_application_creation.sql`
13. `202607130009_atomic_application_status.sql`
14. `202607130010_atomic_application_notes.sql`
15. `202607130011_fix_application_notes_whitespace.sql`
16. `202607130012_atomic_application_deadline.sql`
17. `202607130013_atomic_application_follow_up.sql`
18. `202607130014_atomic_application_deletion.sql`
19. `202607130015_atomic_job_extraction_persistence.sql`
20. `202607130016_atomic_parser_analysis_credits.sql`
21. `20260716042744_append_only_parser_analysis_credit_events.sql`
22. `20260716064357_revoke_parser_reservation_client_writes.sql`

All twenty-two are committed and applied to the connected development Supabase
project. Migrations 003–005 are
forward-only repairs to `import_guest_draft()`; migration 006 repairs only
`save_master_profile()`; `007`–`014` are the Applications foundation and
atomic creation/status/notes/deadline/follow-up/deletion sequence; `015` is
atomic extraction persistence; `016`–`017` are the mutable parser-credit
reservation plus append-only event foundations; and `018` revokes direct
reservation-table writes from authenticated while retaining own-row SELECT via
RLS and authenticated RPC execution. Do not edit or squash applied migration
history.

## 5a. AI routing (Luna parser and tailoring implemented; Terra/Sol planned)

- **Luna parser route — implemented:** validated structured JD extraction uses
  the server-only OpenAI Responses API, versioned schemas, deterministic
  confidence, and environment-driven `OPENAI_MODEL_LUNA`. Feature code does
  not hardcode a production model ID. It never writes final resume content.
- **Luna tailoring route — implemented:** one server-only Responses request
  selects references from approved fragments and structured evidence. Retries
  are disabled, free-form claims are rejected, and complete document assembly
  remains deterministic outside the provider.
- **Terra route — planned only:** requirement normalization,
  confirmed-evidence mapping, directional explanations, next actions, and
  first-pass claim classification.
- **Sol route — planned only:** nuanced evidence-backed resume suggestions,
  supported rewriting, difficult claim review, and final semantic review.

`OPENAI_API_KEY` and `OPENAI_MODEL_LUNA` configure the runnable parser and
tailoring-generation tasks.
`OPENAI_MODEL_TERRA` and `OPENAI_MODEL_SOL` are planned names only; no Terra or
Sol production route is runnable. The future escalation, reviewable evidence,
claim, and deterministic-rendering policy remains in TECHNICAL_DESIGN.md §3
and v3 §F. Do not invent concrete model values or claim an escalation route
exists before it is implemented.

Parser-credit boundary as built:

- Migration `016` uses a mutable reservation-state table and authenticated
  reserve/finalize RPCs. Lifetime successful capacity is two: `reserved` and
  `consumed` count, while `refunded` does not. The rolling 24-hour attempt
  limit is three and counts every reservation row, including refunded rows.
  Limit evaluation returns `daily_limit` before `no_credits`; advisory/row
  locking protects concurrent calls, and finalization is idempotent.
- Migration `017` keeps accounting separate in append-only events. Each real
  reservation produces one `reserved` event, each real terminal transition
  produces one `consumed` or `refunded` event, repeats produce no duplicate,
  and consumed/refunded cannot coexist. Ownership is derived, fields are
  minimal, users can select only their own events, and anonymous/authenticated
  direct event writes are not allowed.
- This parser-credit system is separate from `tailoring_credit_ledger`, and
  Analyze and Analyze Again share the parser-credit-enforced action path.
- `parser_analysis_credit_reservations` has only an authenticated own-row
  SELECT policy. Migration `018` removed authenticated direct INSERT/UPDATE/
  DELETE privileges while preserving that SELECT/RLS boundary and
  authenticated reserve/finalize RPC execution.
- `extractAndPersistPrivateJobAction` and
  `createPrivateJobExtractionActionHandler` route through the server-only
  `extractAndPersistOwnedJobWithCredits` coordinator, created by
  `createParserAnalysisCreditCoordinator`, which reuses
  `extractAndPersistOwnedJob`. The request-bound authenticated Supabase client
  relies on `auth.uid()` inside the existing RPCs; normal user execution uses
  no service-role client and duplicates neither provider nor persistence logic.
- Reservation mapping is typed and closed: `reserved` proceeds; `no_credits`
  returns no-credit; `daily_limit` returns rolling-limit;
  `unsupported_source` returns unsupported-source; `invalid_input` returns
  invalid-job-text; and unavailable, malformed, or reservation transport
  failures return sanitized credit-unavailable. Internal reservation IDs, SQL
  errors, provider payloads, prompts, and stack traces are not exposed.
- Blocked outcomes invoke neither provider nor persistence. Successful
  persistence, including `already_persisted`, finalizes as `consumed`; provider,
  extraction, validation, orchestration, or persistence failures after
  reservation finalize as `refunded`. Finalization transport failure receives
  exactly one idempotent retry without repeating provider or persistence work.
  Reservation IDs stay server-only, and blocked or failed re-analysis preserves
  the previous persisted analysis.

URL/manual-fallback boundary as built:

- URL-only private jobs store a normalized HTTP/HTTPS `source_url`,
  `intake_source='pasted_url'`, and no fabricated `raw_text`. Common tracking
  parameters and fragments are removed; unsafe local/literal hosts,
  credentials, non-default ports, unsupported protocols, malformed URLs, and
  sensitive query keys are rejected.
- Automatic URL retrieval is not implemented. There is no server-side fetch,
  DNS lookup, HTML parsing, crawling, redirect processing, scraping, or job-
  board adapter. Manual pasted text remains the only parser input.
- A URL-only Job Detail shows a manual-paste-required state. Only the
  authenticated owner can atomically add valid manual text and transition the
  same job from `pasted_url` to `pasted_text`; `source_url` and existing
  extraction remain unchanged, and no duplicate job is created.
- URL creation and manual preparation call no provider, parser-credit reserve
  or finalize path, extraction persistence, `job_intake_events`, or tailoring-
  credit function/table. After transition, Analyze and Analyze Again use the
  existing parser-credit-enforced path unchanged.

## 5b. Codex working record

Continue with one narrow Codex prompt at a time. Every meaningful core task
must finish verification, exclude unrelated diff content, and create a focused
local implementation commit. Record its exact hash or genuine inclusive
implementation range, then record the verified real Session ID for the actual
Codex session. Reuse an already verified ID when multiple tasks occur in the
same continuing session, distinguishing those tasks by their implementation
hashes or ranges. Run `/feedback` only for a new conversation, when the current
session's real ID is unknown, or when session continuity is uncertain. Complete
both existing traceability fields in `CODEX_SESSION_LOG.md`, and then create a
separate small log-only documentation commit because the implementation commit
cannot contain its own final hash. Do not push either commit without explicit
user permission.

A meaningful task with a missing implementation hash or range, or without a
verified Session ID for its actual session, is `CONDITIONALLY COMPLETE`, not
`PASS`. A same-session task is not conditional merely because `/feedback` was
not rerun when the verified ID is already known. Failed verification does not
justify a partial commit, and unsafe unrelated worktree changes are a blocker
rather than commit content. Never reuse an ID across different sessions or
invent, infer, reconstruct, shorten, or substitute a Session ID, verification
result, commit, push, or historical entry. Historical values are backfilled
only from authoritative session records or confidently matched Git history;
unrecoverable values remain honestly documented.

## 6. Verification status

Passed during the reported checks: `npm run lint`, `npm run typecheck`,
`npm run build`; configuration-disabled `/resumes/master` renders without
mock production data; `/start`, `/board`, `/jobs` fallback routes functional;
no browser console warnings/errors observed.

Live checks completed against the development Supabase project:

- all twenty-two migrations through `20260716064357` applied and expected
  objects found;
- `save_master_profile()` persistence, replacement/clearing, confirmation,
  ownership, application payload, and later-failure rollback passed;
- normal, sequential-idempotent, canonicalized, concurrent, and
  existing-account `auto`/`merge` guest-import behavior passed;
- two-user RLS isolation passed specifically for `job_postings`, `profiles`,
  `master_profiles`, `master_profile_entries`, and `guest_draft_imports`,
  including supported own writes, spoof rejection, server-only ledger writes,
  and anonymous isolation;
- authenticated atomic board submission and the public `/board/submit` guest
  state passed, including zero-write unauthenticated rejection and private raw
  JD boundaries;
- the real approved-board save action passed first save, sequential duplicate,
  live unique-index enforcement, second-user independence, per-user isolation,
  unavailable-row rejection, and no copied board summary/raw JD;
- production-build browser and direct-HTTP route protection, root redirects,
  authenticated access, sign-out, and no private guest response content passed.
- Applications `007`–`014` passed authenticated creation/idempotency, seven
  status persistence, private tracker/detail/timeline reads, status/notes/
  deadline/follow-up real-change and no-op behavior, minimal event metadata,
  anonymous/two-user isolation, synchronized concurrency, deletion cascade,
  linked-job/company and unrelated-data preservation, tracker removal,
  Add Application re-eligibility, recreation with one initial event, foreign
  private-not-found behavior, honest no-Supabase states, and complete fixture
  cleanup.
- the private pasted-text parser passed its reported versioned-schema,
  deterministic-confidence, server-only provider, ownership, atomic
  persistence, orchestration, server-action, and Job Detail display/control
  checks; no live authenticated OpenAI success is claimed;
- parser credits passed lifetime-limit and refund behavior, rolling 24-hour
  limit and exact boundary behavior, concurrent reservations near both limits,
  concurrent consume/refund/mixed finalization, finalize idempotency, event
  uniqueness/consistency, ownership isolation, anonymous rejection, cleanup,
  and tailoring-credit noninterference. No OpenAI API request was made for the
  database credit work.
- migration `018` verified authenticated own-row reservation SELECT through
  RLS, removal of direct authenticated INSERT/UPDATE/DELETE table privileges,
  and continued authenticated reserve/finalize RPC execution;
- parser-credit action integration passed 136 focused tests, lint, typecheck,
  and the production webpack build. Blocked reservation outcomes made zero
  provider, persistence, and finalization calls. Success made one reserve, one
  provider call, one persistence operation, and one successful finalization.
  Provider and persistence failures caused refund finalization. Finalization
  transport failure received exactly one retry without repeated provider or
  persistence work. Failed re-analysis preserved existing persisted analysis.
  No real OpenAI API request was made.
- URL/creation/transition/UI-state verification passed 56 focused tests, and
  the existing AI/parser-credit/action regression suite passed 136 tests.
  Lint, typecheck, the production webpack build, both diff checks, and complete
  implementation diff review passed. URL creation and manual preparation made
  no provider, parser-credit reservation/finalization, extraction-persistence,
  intake-event, or tailoring-credit call.

Parser-credit action integration is `CONDITIONALLY COMPLETE`: production
integration and repository verification passed, and the database lifecycle was
verified live. The deployed Server Action was not tested with a fake provider
because safely injecting one would require an unauthorized production testing
bypass. This is a verification limitation, not a known implementation defect;
no deployed fake- or real-provider success is claimed.

URL/manual-fallback browser verification is `CONDITIONALLY COMPLETE`. The
local development app started, linked development Supabase was reachable, and
disposable identities were created, but the available administrative login
flow produced an implicit-token callback while the application requires PKCE
authorization-code authentication. An authenticated application session and
URL-only browser job could not be completed; Analyze was never submitted. This
is a verification-environment limitation, not a known implementation defect.
No submitted job URL or OpenAI request occurred. All disposable identities and
scoped rows were deleted, final scoped fixture counts returned to zero, and no
test authentication material was retained in the repository, documents,
browser state, or fixtures.

The pre-Applications release gate is complete. The only conditional limit is
guest-import post-write rollback: it was not behaviorally exercised because
the current RPC has no safe caller-controlled later failure after its complete
pre-write validation. Do not relabel that limitation as a passed rollback test,
and it did not block Applications CRUD.

## 7. Known risks (current, narrow)

1. Guest-import post-write rollback remains conditionally unexercised for the
   structural reason in §6; no production schema/function change should be
   introduced solely to create a test hook.
2. The `Imported job - add title` placeholder creates an explicit review
   step before an imported job is useful (intentional, but real friction).
3. Manual company creation and private-job creation are separate RLS-protected
   writes; a failed job insertion may leave a harmless unused company row
   (MVP cleanup debt, not a blocker).
4. If duplicate board saves already exist, the unique-index migration fails
   intentionally rather than silently preserving invalid duplicates.
5. No permanent browser/database integration-test suite exists for the
   Applications flows; live coverage used disposable fixtures.
6. Tracker drag-and-drop, Table/Calendar modes, resume attachment, arbitrary
   timeline entries, recruiter contacts, notifications, and Calendar
   integration are not implemented.
7. The deployed Server Action was not tested with a fake provider because that
   would require an unauthorized production testing bypass. Repository and
   live database lifecycle verification passed; this is not a known defect.
8. No live authenticated OpenAI success is proven. URL collection plus manual
   pasted-text fallback and production tailoring are implemented, but browser
   PKCE smoke verification and server-side URL retrieval remain outstanding.
   Mechanical claim checking and downloadable file export remain deferred;
   the current deterministic Print/PDF surface uses the browser print path.

## 8. Next work (in order)

**Next narrow boundary: configure SMTP or another safe PKCE-compatible
authenticated fixture and complete the deferred browser smoke verification.**
Structured extraction, Profile Match, approved resume fragments, tailoring
preflight, credit-safe generation, immutable review, and Print/PDF are
complete; do not redo them. This is a testing-infrastructure boundary, not
permission to add a production authentication bypass.

Remaining roadmap order:

1. Establish a normal PKCE-compatible disposable browser-auth testing path and
   complete the deferred URL-only/manual-paste smoke test.
2. Only after that verification, consider a separately bounded server-side URL
   retrieval transport with manual fallback preserved; it is not implemented
   or approved by this handoff.
3. Mechanical claim checker.
4. Downloadable deterministic file export beyond browser Print/PDF.
5. Final MVP integration and end-to-end QA.

One-week MVP execution priorities: PRODUCT_STRATEGY.md §12.

## 9. Warnings for future agents

- **Do not redo completed work:** board submission (`/board/submit` + atomic
  RPC), private Jobs CRUD, Master Profile persistence, guest-draft import, and
  Applications CRUD through deletion/recreation (`007`–`014`), private
  pasted-text parsing (`015`), parser-credit database foundations and ACL
  hardening (`016`–`018`), production Analyze credit enforcement, URL-only
  collection with owner-only manual pasted-text fallback, structured Profile
  Match, and credit-safe immutable tailoring generation are done — extend,
  don't rewrite.
- **Do not rewrite the app shell or redesign completed screens.**
- **No blanket scraping or crawling, ever.** Current URL intake stores a
  normalized URL and requires manual pasted text; it performs no fetch, DNS
  lookup, HTML parsing, redirect processing, scraping, or job-board adaptation.
  Do not add `fetch(url)` casually or claim URL contents are retrieved
  automatically. No CAPTCHA/login-wall/bot-protection bypasses of any kind.
- **Do not bypass authentication for browser testing.** Complete the deferred
  smoke test only through a normal PKCE-compatible disposable-user flow.
- **Do not reimplement parsing or credit logic inside URL intake.** Preserve
  manual pasted text as parser input and the existing credit-enforced Analyze /
  Analyze Again path after transition to `pasted_text`.
- **No auto-apply, ever.** Users apply on the original site via `source_url`.
- **Never republish job-description text through `board_jobs`.** Raw pasted
  JD belongs only in private `job_postings.raw_text`; board entries are
  public-safe metadata + in-house summaries + link-outs. User submissions
  require moderation (`pending_review` → `approved`) before public
  visibility.
- **Public board ≠ private saved jobs** (`board_jobs` vs `job_postings`);
  a board rejection never affects the submitter's private copy.
- **Evidence `confirmed` is a trust boundary.** Only user-confirmed evidence
  may back future AI suggestions; never mark AI output as confirmed.
- **Match language:** "N roles match your profile", never "you are eligible";
  no interview/offer/outcome implications (DESIGN.md §22.4, §23.6).
- **Parser credits are enforced in Analyze and Analyze Again.** Keep the
  request-bound authenticated RPC path, server-only reservation identifiers,
  existing extraction/persistence bridge, and separation from tailoring
  credits. Tailoring credits are reserved before generation and debited only
  with complete document persistence; preserve refund and replay semantics.
- **Print/PDF rendering is deterministic** — no AI call and only the persisted
  immutable document. Downloadable export and mechanical claim checking remain
  separate future boundaries (TECHNICAL_DESIGN.md v3 §G).
- **Luna parser and tailoring-generation routes are runnable.** Both resolve
  `OPENAI_MODEL_LUNA` server-side. Terra and Sol remain planned, and feature
  code never hardcodes models.
- **Log meaningful Codex work** with the mandatory verified implementation
  commit → verified Session ID for the actual session → completed existing
  log fields → separate log-only commit sequence. Reuse a known verified ID
  only within the same continuing session; use `/feedback` for a new, unknown,
  or uncertain session. Treat missing real traceability as `CONDITIONALLY
  COMPLETE`, never fabricate or backfill unsupported evidence, and never push
  without explicit user permission.
- Next.js is `16.2.10` (promise-based `params`; read
  `node_modules/next/dist/docs/` per AGENTS.md). Build uses
  `next build --webpack`. Icons: keep `lucide-react` despite
  `components.json` saying Phosphor.
- `lib/mock/` remains available for tests/development only; no production
  route, route-used component, or production helper imports it after R1-3A
  through R1-3F. The complete series is deployed and fresh-account production
  verification confirmed the audited state; R1-3 is complete. Do not delete
  `lib/mock/` wholesale.

## R2-1A Dashboard next-action foundation

Implementation commit `c779f5b1c42f1c154553c59401b0976cfaff109a`
replaces the Dashboard's basic aggregation with a deterministic view model
derived only from the authenticated user's persisted Master Profile, private
jobs, applications, valid job extractions, and complete immutable v2 resume
versions. Raw job text and extraction or resume payloads stay server-side and
are reduced to booleans or UI-safe identifiers before rendering.

New users progress through four ordered milestones: Master Profile, first saved
job, first valid analysis, and first complete tailored resume. Once all four
exist, the Dashboard presents one primary action and at most three queued
actions. Active priorities are fixed as: add manual text to a URL-only job,
analyze a job with usable text, review tailoring preflight, start application
tracking, then review a nonterminal tracked application. Equal-priority actions
sort by earliest deadline, oldest update time, then stable action ID.

Focused Dashboard tests passed 8/8. Lint, typecheck, the production Next.js
webpack build, and both diff checks passed. R2-1 remains unchecked because this
slice establishes the data/view-model foundation only; no broader Dashboard
redesign or later R2 work was performed.

## R2-1B Dashboard next-action UI

Implementation commit `2016caf08e14ab64faa57e564d92a44f614005c7`
connects the R2-1A persisted-data view model to the production Dashboard. New
users see the four ordered Profile, first job, first analysis, and first
tailored-resume milestones. The first incomplete milestone is highlighted as
the current step with `aria-current="step"`, and the onboarding state exposes
one primary Continue action.

Active users see one dominant next action and at most three queued actions from
the existing deterministic priority model. The former metrics, application
pipeline, recent-jobs table, deadline panel, percentage-width presentation, and
their competing actions are no longer rendered. Authentication, unavailable
states, existing routes, shell, tokens, queries, and action semantics remain
unchanged.

Focused Dashboard tests passed 8/8. Lint, typecheck, the production Next.js
webpack build, scoped legacy-presentation grep, and both diff checks passed.
R2-1 remains unchecked pending deployment and production verification.

## R2-1 production completion

Deployed revision `6a639a081d3df13b3889277bfe4e9c76bce734a0`
completed successfully in Vercel Production. A fresh production account showed
the four ordered onboarding milestones, highlighted only the current Profile
step, and exposed one primary Continue CTA.

Through the normal product UI, the same disposable account saved a real Master
Profile, confirmed evidence and an approved resume fragment, saved and analyzed
a synthetic private job, created an application, and generated one complete
immutable tailored-resume version. The resulting active Dashboard displayed one
primary persisted application action and zero queued actions. Database
inspection confirmed one owned Master Profile, job, application, and resume
version backed the displayed state.

Neither Dashboard state showed the removed analytics cards, fabricated metrics,
percentages, eligibility or outcome language, or competing primary actions.
The disposable account and all owned rows were deleted through the normal
Settings flow, and the remaining smoke-only company row was removed after its
job relation was gone. Final scoped counts returned to zero. R2-1 is complete
and checked; do not start R2-2 without separate authorization.

## R2-2 unfounded metrics removal

Implementation commit `1f5a49ede017c2747fe2b1823ad2c1f85114aecd`
removes the remaining legacy `job.matchScore` presentation from the production
saved-jobs table. The “Estimated match” column, percentage badge, tone helper,
client-facing `matchScore` type, and `match_score` selection/mapping in the
general private-job loader were removed. Job Detail already had no legacy
Estimated match block, and no production surface contained Estimated callback
rate.

The deterministic matcher and its internal coverage calculations remain
unchanged. Job Detail and `/jobs/matches` continue to present explainable
matched/not-evidenced counts by category, while parser confidence remains a
separate legitimate extraction-quality value.

Focused tests passed 49/49. Lint, typecheck, the production Next.js webpack
build, production user-facing grep, and both diff checks passed. Vercel
successfully deployed the implementation revision. A disposable production
account confirmed `/jobs` has no Estimated match column, analyzed Job Detail
shows count-only Profile Match groups (`2 of 2 found`, `0 of 1 found`), and
`/jobs/matches` contains no percentage or coverage presentation. The account
and all smoke-only job/company data were deleted; scoped counts returned to
zero. R2-2 is complete and checked; do not start R2-3 without separate
authorization.

## R2-3A resume PDF upload and deterministic extraction

Implementation commit `b427f60d9145816ea08d4a2f0df856b0965ca1ca`
enables authenticated PDF upload from the existing Resumes hub and extracts
selectable text server-side with `unpdf`. The upload is limited to PDF files up
to 5 MB and 25 pages; the Server Action request limit is 6 MB to accommodate
multipart overhead. Parsing has a 10-second timeout, a bounded image allocation,
and a 100,000-character extracted-text limit.

Invalid, empty, oversized, encrypted, malformed, unreadable, and scanned or
image-only PDFs return fixed honest messages. OCR is not performed. Successful
text is normalized deterministically and returned only to a read-only browser
preview that explicitly states the PDF and text were not saved.

The action re-authenticates the request. It performs no storage upload, database
write, OpenAI/provider call, profile drafting, evidence creation, or confirmation
change, so existing Master Profile persistence and trust boundaries remain
unchanged. Focused extraction/upload tests passed 14/14, including a real
`unpdf` selectable-text fixture. Lint, typecheck, the production Next.js webpack
build, and both diff checks passed. R2-3 remains unchecked because AI drafting
and user confirmation are later slices; do not proceed without separate
authorization.

## R2-3B unpersisted Master Profile draft generation

Implementation commit `b25e0e8fc22a94243b9349b3a4f90796b0e61cda`
extends the authenticated PDF flow so a successful extraction is passed to one
server-only OpenAI Responses request. Resume drafting has its own centralized
`OPENAI_MODEL_RESUME_PROFILE_DRAFTING` setting, uses the existing live-provider
kill switch and API-key boundary, sends no more than 30,000 extracted
characters, sets `store: false`, uses zero retries, a 30-second timeout, and a
4,096-token output cap.

The strict `resume-profile-draft-v1` result supports education, general skills,
work experience, projects, and leadership/activities only. The provider must
copy entry text verbatim and may return only skills whose exact words occur in
the extracted resume. Server orchestration validates every returned value
against the extracted text, rejects the entire unsupported result, removes
case-insensitive duplicates in stable order, and assigns `confirmed: false`
itself. Provider output cannot supply confirmation state.

The Resumes hub shows the result as a temporary review-required preview.
Neither the PDF, extracted text, nor draft is persisted; no Master Profile
entry, candidate evidence, approved resume fragment, database/Storage write,
parser credit, tailoring credit, or migration is involved. Provider,
validation, and configuration failures map to fixed browser-safe messages while
the extracted-text preview remains available.

Focused schema, provider, orchestration, PDF, diagnostics, legal-copy, and UI
tests passed 50/50. Lint, typecheck, the production Next.js webpack build, and
both diff checks passed. R2-3 remains unchecked because accepting or persisting
reviewed draft entries is not part of R2-3B; do not continue without separate
authorization.

## R2-3C import resume drafts for review

Implementation commit `df785f22556f6b5eac4152a85f30bc729283ca3b`
adds one explicit `Import draft for review` action beneath the temporary
resume-draft preview. The authenticated Server Action strictly reparses the
client-returned draft, reloads the current owner-scoped Master Profile, merges
only new normalized evidence, and redirects to `/resumes/master` after the
existing atomic `save_master_profile` path succeeds.

AI-drafted education, work experience, projects, leadership/activities, and
skills all become Master Profile entries with `confirmed: false`. Draft skills
are not silently promoted into the trusted top-level skills collection.
Provider-set confirmation state and fragment fields are rejected. New entries
receive empty fragment arrays, so no approved resume source fragment is created.

Existing populated profile fields, top-level skills, candidate evidence,
confirmed entries, and manual approved fragments are preserved. Duplicate
entries are skipped by whitespace-collapsed, case-insensitive section-and-text
identity; skills already present in top-level skills and repeated draft skills
are skipped. A profile-load or save failure returns fixed safe copy and the
single existing transactional RPC leaves prior data unchanged. Import performs
no OpenAI/provider request, OCR, credit operation, or migration.

Focused draft-import, profile-persistence, fragment-preservation, draft
provider, PDF, and Resumes-hub tests passed 47/47. Lint, typecheck, the
production Next.js webpack build, and both diff checks passed. R2-3 remains
unchecked pending the separately authorized completion and production
verification of the resume-upload onboarding flow.

## R2-3 production completion

Production revision `c41de40018e4cc1ae4c341bc53af1d668e60025c` initially
failed closed after successful PDF text extraction because Vercel Production
did not contain the existing `OPENAI_MODEL_RESUME_PROFILE_DRAFTING` setting.
The missing server-only setting was added for Production with the configured
`gpt-5-mini` model, and the same revision was redeployed without a code change.

A fresh disposable production account verified the complete flow on
`internshipbc.dev`: a selectable-text PDF extracted successfully; the bounded
OpenAI request produced the strict temporary draft; all seven imported entries
were visibly and persistently unconfirmed; no draft data existed in Master
Profile before import; import redirected to `/resumes/master`; existing
confirmed evidence and its approved manual fragment remained unchanged; no
approved fragment was created for imported entries; one imported entry was
confirmed and saved individually; and an image-only PDF returned the honest
no-selectable-text response without OCR. The disposable account was deleted
after verification.

R2-3 is complete and checked. Do not start R2-4 without separate
authorization.

## R2-4A bounded server-side URL fetch transport

Implementation commit `2eb819618e4f5c86f301cf2c3e6e380fcc7c6124`
adds a server-only transport foundation for one authenticated owner's saved
job URL. The coordinator authenticates with the request-bound Supabase client
and reads only `source_url` from the owner-and-job-scoped private row. It has no
route, UI, persistence, Analyze, credit, provider, OpenAI, or public-board
integration.

The transport accepts normalized HTTP/HTTPS URLs only, rejects credentials,
non-default ports, localhost and unsafe literals, validates every DNS answer,
and pins the single outbound request to one validated public address. Private,
loopback, link-local, shared, multicast, documentation, benchmark, transition,
and reserved IPv4/IPv6 ranges fail closed. Redirects are not followed; there
are no retries, adapters, crawling, browser automation, or access-wall bypass.

The request has an 8-second timeout and a 1 MiB response limit. Only
uncompressed `text/html` and `text/plain` are accepted. Deterministic
extraction removes comments, scripts, styles, noscript/template/SVG content,
HTML markup, and excess whitespace; extracted text is limited to 100,000
characters. Results are fixed typed states for success, authentication or
ownership unavailability, missing/blocked sources, redirects, timeouts,
oversized bodies, unsupported content, HTTP/network failure, empty text, and
transport unavailability.

All network and DNS behavior in tests is mocked; no real website was fetched.
Focused URL transport, intake, and manual-transition tests passed 88/88. Lint,
typecheck, production Next.js webpack build, and both diff checks passed.
R2-4 remains unchecked because no UI, persistence, or Analyze integration is
included in R2-4A.

## R2-4B persist successful bounded URL fetches

Implementation commit `6a819641d9219021d12d8fdd3b1a650f3d032fea`
adds an authenticated Server Action and server-only coordinator for an existing
URL-only private job. The action accepts only the private job ID. R2-4A derives
the saved `source_url` from the authenticated owner's row and is invoked
exactly once; no alternate client URL is accepted.

Only a successful bounded fetch reaches persistence. The existing manual-paste
transition boundary now exposes its owner-scoped conditional updater for both
paths. One Supabase UPDATE writes `raw_text` and changes `intake_source` from
`pasted_url` to `pasted_text`, constrained by job ID, authenticated owner,
current intake source, and the exact URL that was fetched. `source_url`,
existing extraction, and all unrelated fields are omitted from the update and
remain unchanged. No job or public-board row is inserted.

Every redirect, blocked URL, timeout, size/content/HTTP/network failure, empty
result, or unavailable source returns the single sanitized
`manual_paste_required` state without obtaining a persistence context or
performing a write. Authentication, ownership races, and persistence failures
remain separate safe typed states. The action revalidates the jobs list and
owned Job Detail only after a confirmed update.

Focused transport, persistence, URL-intake, and manual-transition tests passed
94/94. Lint, typecheck, the production Next.js webpack build, and both diff
checks passed. No UI, Analyze, OpenAI/provider, parser-credit, tailoring-credit,
redirect following, retry, crawling, adapter, or bypass behavior was added.
R2-4 remains unchecked pending later UI and flow integration.

## R2-4C URL-only Job Detail fetch and analyze

Implementation commit `0139bfae407e3c27d8a1ebe887e415c4dd48f344`
connects the R2-4A/R2-4B boundaries to owned URL-only Job Detail. A
`pasted_url` job now shows one primary `Fetch and analyze` action alongside the
existing manual-paste fallback, whose save button is secondary.

One submission calls the existing owner-scoped bounded fetch-and-persist
orchestrator once. Only its confirmed success invokes the unchanged
credit-enforced Analyze handler once. Fetch failures return before Analyze, so
they perform no provider, parser reservation, or credit call. Blocked URLs,
redirects, timeouts, oversized or unsupported content, HTTP/network failures,
empty text, and unavailable transport use fixed reason-specific copy, retain
manual paste, and explicitly state that no parser credit was used.

After successful fetch persistence, existing analysis outcomes remain
authoritative. Credit limits and provider, validation, and persistence failures
reuse existing sanitized Analyze messages. The fetched private description
remains saved and the UI disables another fetch, offering only a refresh into
the normal pasted-text Analyze state. Existing parser reservation refund and
finalization behavior is unchanged.

The client runner rejects duplicate in-flight submission, and the button is
disabled while pending. No redirect following, retry, crawling, adapter,
CAPTCHA/login-wall bypass, alternate URL, public-board exposure, or duplicated
fetch/parser/credit implementation was added.

Focused orchestration, UI, transport, persistence, parser-credit, Analyze, and
Profile Match tests passed 186/186. Lint, typecheck, production Next.js webpack
build, and both diff checks passed. R2-4 remains unchecked pending production
verification.

## R2-5A immutable user-edited resume-version persistence

Implementation commit `750ae23539fe825c7bf3a369403058c0de2236a7`
adds the persistence foundation for user-authored edits without changing the
generated original. A strict server-only coordinator authenticates the request,
loads only an owned generated v2 version, validates the requested retained
bullets against that immutable parent, and permits only bullet wording changes,
removal, and within-entry ordering.

The final normalized document is inserted atomically as a new
`resume_versions` row. The child preserves the owned job relation, records
`authorship = 'user_authored'`, links through `parent_version_id`, and carries a
strict user-edit content envelope. Parent content and metadata are never
updated or deleted. Invalid, empty, foreign, missing, already-edited, or
unavailable parents fail closed before insertion. No provider, OpenAI, credit,
reservation, ledger, or UI path is involved.

Forward-only migration
`20260729050747_add_user_edited_resume_versions.sql` adds the self-referential
parent link and bounded authorship field to the existing table, with no
parallel table or backfill. Existing rows retain the default
`ai_generated`/no-parent state. Browser INSERT, UPDATE, and DELETE policies are
removed, leaving owner SELECT access while trusted server persistence remains
append-only. The migration is applied to the linked development project; all
33 local and remote migrations align, the existing two generated versions
remain unchanged, and no new resume-version security-advisor finding was
introduced.

Focused persistence, schema, loader, generated-document, finalization,
reservation, and application-workflow tests passed 53/53. Lint, typecheck, the
production Next.js webpack build, and both diff checks passed. R2-5 remains
unchecked because editing UI and Print/PDF integration are later slices.

## R2-5B tailored-resume editing UI

Implementation commit `663d45d97a67343824effe15e4b0fd33e673ed4c`
connects owned generated v2 resume versions to the R2-5A append-only
persistence boundary. Generated originals now expose an accessible editor for
changing bullet wording, removing bullets, and reordering bullets within their
existing entry. Saving creates and opens a new user-authored child version;
the generated parent remains immutable.

The review route validates persisted authorship and parent metadata before
rendering and labels versions as `Generated original` or `User-edited version`.
Only generated originals can open the editor. Empty or malformed submissions,
foreign or missing parents, and unavailable persistence return fixed sanitized
states. The client bundle uses a dedicated input contract and has no provider,
credit, reservation, ledger, database, or server-only document dependency.

Print/PDF continues to render the currently opened persisted version, so a
user-edited child reloads and prints its saved bullet wording and order. No AI
request, credit use, schema change, parent update, or redesign was added.

Focused editor, persistence, owner-loader, migration, and review tests passed
26/26. Lint, typecheck, production Next.js webpack build, and both diff checks
passed. R2-5 remains unchecked pending production deployment and verification.

## R2-5 production completion

Production initially rejected edited-version saves before validation or
persistence because the `"use server"` action module exported a runtime state
object. Next.js permits only async function exports from such modules.
Implementation commit `25897dc2992a8a4db1a0d1c1fc2c7281701b8943`
moves the initial form state to the client editor while leaving the Server
Action contract and owner-scoped persistence boundary unchanged.

The exact revision was deployed to `internshipbc.dev`. Production verification
confirmed bullet editing, removal, and reordering; creation and reload of a
linked `user_authored` child; an unchanged generated parent; accurate generated
and user-edited labels; and Print/PDF from the opened child document. Database
before/after checks confirmed no provider request, credit balance change,
reservation, reservation event, or ledger event. Temporary parent and child
fixtures were deleted and scoped fixture counts returned to zero.

The focused regression and rendering suites passed 26/26. Lint, typecheck,
production Next.js webpack build, and both diff checks passed. R2-5 is complete
and checked.

## R2-6A application resume-version persistence

Implementation commit `527988e1d3aec3a003fafcd2b44d64cd2d14ebe5`
adds an optional immutable resume-version link to application creation without
changing the one-application-per-job product rule. The existing authenticated
creation action accepts an optional version ID and delegates to the same atomic
database RPC; existing callers omit it and continue creating unlinked
applications.

Forward-only migration
`20260729182516_link_application_resume_version.sql` adds nullable
`applications.resume_version_id`, a composite owner/job foreign key, and a
defaulted optional RPC parameter. The RPC derives the user from `auth.uid()`,
requires both the private job and selected resume version to belong to that
user, requires the version to belong to the same job, retains the advisory
transaction lock, and inserts the application plus initial timeline event in
one transaction. Foreign or job-mismatched versions return the existing safe
unavailable result before writes. Deleting a linked version clears only the
optional link and preserves the application.

The migration is applied to the linked development project; all 34 local and
remote migrations align. Transaction-scoped database verification passed for
linked and legacy unlinked creation, owner/job mismatch rejection, idempotent
replay, one initial event, deletion behavior, and forced-failure rollback.
Disposable fixture counts returned to zero. Focused tests passed 39/39; lint,
typecheck, production Next.js webpack build, and both diff checks passed. No
AI/provider, credit, status, date, or UI behavior was added. R2-6 remains
unchecked pending later tracker slices and production verification.

## R2-6B one-click Job Detail application tracking

Implementation commit `6aff6c306f03a5f65c92534e0acdda4a3cd6a200`
connects owned Job Detail to the R2-6A atomic creation boundary. An untracked
job shows `Track application`; one submission selects an eligible owned
tailored-resume version, creates the application and initial timeline event
through the existing RPC, and opens the application detail. A tracked job
shows `View application` and creates nothing.

Selection performs one owner- and job-scoped resume-version query at click
time. It considers only structurally valid persisted v2 generated originals
and valid user-authored children whose generated parent is present for the
same job. The newest eligible version wins; an edited child wins an exact
timestamp tie with its generated parent, followed by a stable ID tie-break.
When no version is eligible, the application is created unlinked. The R2-6A
RPC remains the final ownership, same-job, concurrency, idempotency, and
atomicity boundary.

The client retains its synchronous submission guard and pending disabled
state, so duplicate in-flight clicks converge on the existing one-application
RPC behavior. Matching-card tracking retains its prior labels and unlinked
creation behavior; this slice changes only Job Detail. No migration,
AI/provider request, credit use, automatic status change, date UI, or redesign
was added.

Focused selection, application persistence, workflow, and rendering tests
passed 35/35. Lint, typecheck, production Next.js webpack build, and both diff
checks passed. R2-6 remains unchecked pending later tracker slices and
production verification.

## R2-6C one-click application status advance

Implementation commit `592cfebf6dfc304032c325d2f0a1be24622f8789`
adds one explicit next-status action to Application Detail while preserving the
existing manual status selector. The deterministic progression is
`Saved → Tailoring → Ready → Applied → Interview → Offer`; both `Offer` and
`Rejected` are terminal and render no advance action.

The control displays the next status and an `Advance to …` button before
submission. It reuses the existing authenticated Server Action and atomic
`update_application_status` RPC, so the owner-scoped row lock, applied-at
behavior, seven canonical statuses, timeline metadata, and path refresh remain
unchanged. A successful transition refreshes the detail and its persisted
timeline. The synchronous submission guard and pending disabled state prevent
duplicate in-flight clicks; concurrent same-target RPC calls serialize, and
the later no-op returns without inserting another event.

Focused status progression, RPC, timeline, owner-isolation, rendering, and
prior application-workflow tests passed 31/31. Lint, typecheck, production
Next.js webpack build, and both diff checks passed. No schema change, migration,
AI/provider request, credit activity, date control, tracker redesign, or
drag-and-drop was added. R2-6 remains unchecked pending later tracker slices
and production verification.

## R2-6D inline application dates

Implementation commit `143869c65990a0c148a2a613ecdc28b4585794de`
completes the bounded inline-date slice on Application Detail. The existing
deadline and timezone-aware follow-up controls continue through their original
atomic RPCs. A matching interview-date control supports set, change, and clear
through a new owner-scoped atomic RPC. Reloaded Application Detail reads all
three persisted values.

Forward-only migration
`20260729191227_add_application_interview_date.sql` adds only nullable
`applications.interview_date date`, permits the new
`interview_date_changed` timeline event type, and adds
`update_application_interview_date(uuid,date)`. The function derives identity
from `auth.uid()`, locks only the caller-owned application, returns unavailable
for missing or foreign rows, and inserts one minimal previous/new-date event
only for a real change. Equal values and repeated clears return unchanged
before the event insert. PUBLIC and anon execution are revoked; authenticated
execution is explicit.

The migration is applied to the linked development project; all 35 local and
remote migrations align. Scoped database verification passed for interview
set, change, no-op, clear, owner isolation, exactly one event per real change,
and cleanup. Deadline and follow-up set/change/clear contract tests also pass.
No notes or private content enters date-event metadata.

Focused application-date, status, ownership, timeline, workflow, and rendering
tests passed 38/38. Lint, typecheck, production Next.js webpack build, and both
diff checks passed. Existing status, notes, delete, and one-click advance
controls remain present. No notifications, Calendar integration, AI/provider
request, credit activity, tracker redesign, or drag-and-drop was added. R2-6
remains unchecked pending production verification.

## R2-6 production completion

Production already contained both forward-only R2-6 migrations, and all 35
local and production migration versions aligned before deployment. Clean
`main` was pushed and Vercel successfully deployed exact revision
`74f2b7a80a518ae5c62e5535fd0259d9b1cabc05` to `internshipbc.dev`.

Production verification confirmed that Job Detail creates exactly one
application, links the newest eligible same-job resume version (including a
user-authored child), and then shows `View application` instead of offering a
duplicate create action. One-click advance persisted the next status with one
timeline event. The existing manual status selector, private notes, and delete
flow remained functional.

Application deadline, interview date, and timezone-aware follow-up each passed
set, change, no-op, clear, and reload verification. Each real change produced
one minimal timeline event; repeated equal submissions produced no event.
Before/after database counts confirmed zero new parser or tailoring
reservations/events, no credit-ledger or balance change, and no OpenAI/provider
activity. The temporary job, generated and edited resume versions,
application, and timeline were deleted; all scoped fixture counts returned to
zero. R2-6 is complete and checked.
