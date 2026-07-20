# HANDOFF.md — COOPfinder Continuation Handoff

> **Purpose:** Let the next coding agent continue without rediscovering the
> current state. This reflects the codebase as of **2026-07-16**.
>
> **Read before coding:** [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) (r2 —
> current), [DESIGN.md](DESIGN.md) (esp. §22–24),
> [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) (esp. the as-built notes),
> [CHATGPT_DIRECTOR_CONTEXT.md](CHATGPT_DIRECTOR_CONTEXT.md),
> [CODEX_SESSION_LOG.md](CODEX_SESSION_LOG.md), [AGENTS.md](AGENTS.md), and
> this file.
>
> **Product direction (unchanged):** Canadian co-op application command
> center. "Found a role? Paste the link. COOPfinder extracts the
> requirements, compares them to your profile, helps you tailor a reviewed
> resume, exports a clean PDF, and sends you back to the original site to
> apply yourself."
>
> **As built today:** saving a URL stores only its normalized link. Automatic
> retrieval is not implemented; the owner must paste the job description
> before the existing Analyze path becomes available.
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

Also in place since earlier phases: Supabase auth (`/login`,
`/auth/callback`, `/auth/sign-out`), `proxy.ts` hybrid route protection,
guest/authed shell states, and `tailoring_credit_ledger` with +2 signup grant.
Production tailoring now consumes exactly one credit only in the same atomic
transaction that persists a complete immutable resume version.

## 2. Current routes (as built)

Public: `/` (authed→`/dashboard`, guest→`/start`), `/start`, `/board`,
`/board/[id]`, `/board/submit` (page is public; submitting requires auth),
`/login`.

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
- Residual mock data (`lib/mock/`) still powers Dashboard, Resumes hub, and the
  Tailoring Workspace; `lib/mock/applications.ts` remains as a compatibility
  fixture but production Applications routes do not import it. The app shell
  uses mock `currentUser` only as cosmetic fallback strings. Replace these per
  phase — do not delete `lib/mock/` wholesale.
