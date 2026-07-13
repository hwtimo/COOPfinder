# HANDOFF.md — COOPfinder Continuation Handoff

> **Purpose:** Let the next coding agent continue without rediscovering the
> current state. This reflects the codebase as of **2026-07-13**.
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
5. **Authenticated board submission** — `/board/submit` +
   `202607120001_atomic_board_submission.sql`:
   `submit_board_job_with_private_copy()` atomically creates the private
   `job_postings` row and the `pending_review` `board_jobs` candidate
   (identity from `auth.uid()`, forced `pending_review`/`is_active=false`,
   review fields not caller-suppliable, `SECURITY DEFINER` + empty
   `search_path`, authenticated-only execute; the older board-only RPC is
   revoked). Submitter status labels: Pending review / On the board /
   Not added / Archived. Honest Supabase-disabled states. No moderation
   dashboard exists (founder moderates in Supabase Studio).
6. **Private saved-jobs CRUD** — authenticated `/jobs` + `/jobs/[id]`:
   create/list/read/edit/delete over persisted rows, search/filters, private
   raw-JD storage, private not-found behavior, approved-board→private saving
   (`intake_source='board_save'`, `board_job_id` set), duplicate board-saves
   prevented by `job_postings_user_board_job_unique_idx`
   (`202607130001_unique_private_board_saves.sql`), honest "Analysis not
   generated yet" state, tailoring unavailable for unprocessed jobs.
   Production Jobs pages no longer show mock jobs as the user's data.
7. **Master Profile persistence + guest-draft import** —
   `202607130002_master_profile_guest_import.sql` (details in §3–4 below and
   TECHNICAL_DESIGN.md §I–J).

Also in place since earlier phases: Supabase auth (`/login`,
`/auth/callback`, `/auth/sign-out`), `proxy.ts` hybrid route protection,
guest/authed shell states, `tailoring_credit_ledger` with +2 signup grant
(schema only — **no production credit consumption exists yet**).

## 2. Current routes (as built)

Public: `/` (authed→`/dashboard`, guest→`/start`), `/start`, `/board`,
`/board/[id]`, `/board/submit` (page is public; submitting requires auth),
`/login`.

Private (via `proxy.ts`): `/dashboard`, `/jobs`, `/jobs/[id]`,
`/applications`, `/applications/[id]`, `/resumes`, `/resumes/master`,
`/resumes/tailor/[jobId]`, `/calendar`, `/insights`, `/documents`,
`/settings`. Guests hitting `/jobs` are redirected to `/board`.

Persistence status by screen: `/board*`, `/jobs*`, `/resumes/master` read and
write **real Supabase data** (with honest disabled states when Supabase env
is absent). Dashboard, Applications (tracker + detail), Resumes hub,
Tailoring Workspace, Calendar, Insights, Documents, Settings still render
**mock/local data** — they are UI-complete but not persisted.

## 3. Master Profile persistence (as built)

- `/resumes/master` loads and saves authenticated Supabase data through the
  `save_master_profile(p_profile, p_skills, p_entries)` RPC — one transaction
  covering profile scalars, skills (stored at `master_profiles.data.skills`),
  and ordered `master_profile_entries` (delete-and-reinsert, `sort_order`
  preserved). Server re-validates all payloads. No AI call. Private data only.
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
  `intake_source='pasted_text'`). No fetch, no scraping, no AI parsing, no
  invented metadata. Title-less imports use the honest schema-required
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

All nine are committed and applied to the connected development Supabase
project. The last three are forward-only repairs to `import_guest_draft()`;
do not edit or squash applied migration history.

## 5a. Planned AI routing (not implemented)

- **GPT-5.6 Luna** (`gpt-5.6-luna`): validated structured JD cleanup,
  extraction, classification, and duplicate candidates. Never final resume
  content.
- **GPT-5.6 Terra** (`gpt-5.6-terra`): requirement normalization,
  confirmed-evidence mapping, directional explanations, next actions, and
  first-pass claim classification.
- **GPT-5.6 Sol** (`gpt-5.6-sol`): nuanced evidence-backed resume suggestions,
  supported rewriting, difficult claim review, and final semantic review.

Model resolution belongs in one server-only configuration module. Feature
code requests a task category and never hardcodes a model ID. Luna failures or
ambiguity escalate to Terra; high-impact language and difficult evidence
questions escalate to Sol. Every suggestion remains reviewable and linked to
confirmed evidence. Failed generations do not consume credits. Unsupported
claims block readiness/export, and final PDF rendering prohibits AI calls.
See TECHNICAL_DESIGN.md §3 and v3 §F for the canonical policy.

## 5b. Codex working record

Continue with one narrow Codex prompt at a time. Meaningful core sessions must
be summarized in `CODEX_SESSION_LOG.md`, linked to their verified commit range,
and include the real `/feedback` Session ID when available. Never invent or
infer a Session ID, verification result, or historical entry.

## 6. Verification status

Passed during the reported checks: `npm run lint`, `npm run typecheck`,
`npm run build`; configuration-disabled `/resumes/master` renders without
mock production data; `/start`, `/board`, `/jobs` fallback routes functional;
no browser console warnings/errors observed.

Live checks completed against the development Supabase project:

- migrations through `202607130005` applied and expected objects found;
- two-user private `job_postings` RLS isolation passed;
- core authenticated `submit_board_job_with_private_copy()` behavior passed;
- one authenticated guest import passed after the three repair migrations;
- exact-repeat guest-import idempotency and canonical JSON object-key-order
  normalization passed without duplicate state.

Still unverified live: guest-import concurrency/advisory locks, injected
rollback, existing-account merge, broad cross-user profile/evidence/ledger
isolation, real-session route protection, duplicate board-save behavior, and
a complete direct inspection of private raw-JD boundaries. Do not infer these
behaviors from the narrower passing tests.

## 7. Known risks (current, narrow)

1. Guest-import rollback and concurrency have not been exercised live.
2. Cross-user isolation is verified for private jobs only, not all private
   profile/evidence/ledger tables.
3. Existing-account guest-draft merge is not live-verified.
4. Duplicate board-save and real-session route behavior remain unverified.
5. The `Imported job - add title` placeholder creates an explicit review
   step before an imported job is useful (intentional, but real friction).
6. Company creation and private-job creation are separate RLS-protected
   writes; a failed job insertion may leave a harmless unused company row
   (MVP cleanup debt, not a blocker).
7. If duplicate board saves already exist, the unique-index migration fails
   intentionally rather than silently preserving invalid duplicates.
8. Applications and downstream workflow remain mock/unpersisted until the
   next phase.
9. AI features and deterministic export are not implemented.

## 8. Next work (in order)

**Remaining release prerequisite (not a product phase):** complete the narrow
live gaps in §6–7, especially guest-import concurrency and rollback, broader
cross-user isolation, existing-account merge, duplicate board-save behavior,
real-session route checks, and private raw-JD inspection.

**Next product phase: Applications CRUD** (free tracking, persisted
timeline). Then: AI job parser for pasted JD text → bounded user-directed URL
intake with paste fallback → AI tailoring with reviewable source evidence and
existing credit boundaries → mechanical claim checker → deterministic PDF
export → final MVP integration and end-to-end QA.

One-week MVP execution priorities: PRODUCT_STRATEGY.md §12.

## 9. Warnings for future agents

- **Do not redo completed work:** board submission (`/board/submit` + atomic
  RPC), private Jobs CRUD, Master Profile persistence, and guest-draft import
  are done — extend, don't rewrite.
- **Do not rewrite the app shell or redesign completed screens.**
- **No blanket scraping or crawling, ever.** Future URL intake is ONE
  user-directed fetch with paste fallback. No CAPTCHA/login-wall/bot-
  protection bypasses of any kind.
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
- **Credits are ledger-based and server-written**; failed generations must
  never burn credits. No production consumption exists yet.
- **Final PDF rendering must be deterministic** — no AI call, exact accepted
  content only, gated on review + claim checks (TECHNICAL_DESIGN.md v3 §G).
- **AI routing is planned, not implemented.** Use the centralized
  Luna/Terra/Sol task policy in TECHNICAL_DESIGN.md §3; only confirmed
  evidence may support suggestions, and feature code never hardcodes models.
- **Log meaningful Codex work** in `CODEX_SESSION_LOG.md` with observable
  verification and a real `/feedback` Session ID when available. Never
  fabricate an ID or backfill unsupported history.
- Next.js is `16.2.10` (promise-based `params`; read
  `node_modules/next/dist/docs/` per AGENTS.md). Build uses
  `next build --webpack`. Icons: keep `lucide-react` despite
  `components.json` saying Phosphor.
- Residual mock data (`lib/mock/`) still powers Dashboard, Applications,
  Resumes hub, and the Tailoring Workspace; the app shell uses mock
  `currentUser` only as cosmetic fallback strings. Replace these per phase —
  do not delete `lib/mock/` wholesale.
