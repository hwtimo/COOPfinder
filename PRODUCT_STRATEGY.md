# PRODUCT_STRATEGY.md — Product-Led Onboarding & Hybrid Auth

> **Status:** Adopted 2026-07-09. This supersedes the earlier assumption of
> `visitor -> login -> protected app -> dashboard`.
> **Read together with:** [DESIGN.md](DESIGN.md) §22 (guest UX rules),
> [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) "Auth & Guest Model v2" (schema/routes),
> [HANDOFF.md](HANDOFF.md) and [CHATGPT_DIRECTOR_CONTEXT.md](CHATGPT_DIRECTOR_CONTEXT.md) (implementation order).

---

## 1. Strategy Summary

COOPfinder does not put a login wall in front of an empty app. A first-time
visitor gets a **guided guest experience** that demonstrates the core value —
*"I entered my profile and now I know which roles I can pursue and what to do
next"* — before any account exists. Login is positioned as **saving your
progress**, not unlocking the door.

The guest flow:

1. Visitor lands on `/start` (or browses a limited public jobs preview).
2. They build a **draft master profile** in the browser: school, program,
   work term, work authorization, skills, experiences/projects.
3. As they type, the app computes **deterministic (non-AI) matches** against a
   small **curated starter catalog** of real Canadian co-op postings and shows
   live feedback: *"6 roles in the starter catalog match your profile"*,
   *"Add more experience to improve matching."*
4. After the value moment, the save prompt appears:
   *"Your profile matches 6 roles. Create a free account to save your profile,
   save jobs, track applications, and tailor your resume — 2 free tailoring
   credits included."*
5. After signup, the draft migrates into Supabase, and the full app opens:
   free job saving, free application tracking, master profile persistence,
   resume upload, and AI tailoring metered by credits.

### What changed vs. the raw idea (strategist adjustments)

| Raw idea | Adopted version | Why |
|---|---|---|
| "Browse applicable jobs before login" | Small **curated starter catalog** (20–40 hand-entered Canadian co-op roles), clearly labeled as a starter set | COOPfinder has no job inventory — the product is user-fed by design. A tiny curated catalog gives guests something real to match against without turning the product into a job board or requiring scraping. Summaries are written in-house; every entry links out to the original posting. |
| Show eligibility counts while typing | Deterministic **client-side matching** (skill overlap + term fit + work-auth filter), no AI for guests | Zero marginal cost, instant feedback, no anonymous-abuse surface, and honest — we can explain exactly why something matched. AI stays server-side and auth-gated. |
| "You may be eligible for N jobs" | **"N roles match your profile"** as primary copy; "appears eligible" only for work-auth/term filters | "Eligible" is a legal/immigration-adjacent claim. Matching is what we actually compute. See DESIGN.md §22.4 language rules. |
| "2 free tailoring credits" as a counter | One-time signup grant of 2 credits in a **server-side credit ledger** | A ledger is auditable, tamper-proof under RLS, and extends to paid credit purchases without schema churn. Replaces the earlier "3 free tailors/month" idea for MVP — one-time grant is simpler to reason about and to message. Revisit with usage data. |

### Non-negotiable product principles (unchanged)

- Application command center, **not a job board**. The starter catalog is a
  demo/matching aid; the primary loop is still "paste your own posting."
- AI is reviewable, never invents experience, never auto-applies.
- No guaranteed-outcome language. Match scores are directional.
- Transparent data handling: guests are told their draft lives on this device
  only; account = saved to their account.
- No scraping. Catalog entries are hand-entered with in-house summaries.

---

## 2. Key Decisions

### D1. What is public (no account)?

| Surface | Guest gets | Notes |
|---|---|---|
| `/` | Redirect: authed → `/dashboard`; guest → `/start` | Marketing landing page comes later; until then `/start` is the front door. |
| `/start` | Guided draft-profile builder + live match feedback | The first-run experience. |
| `/jobs` (guest view) | Starter catalog list: title, company, location, term, work mode, deadline | Limited filters (role type, location, term). Labeled "Starter catalog". |
| `/jobs/[id]` (guest view, catalog only) | Summary, required/nice-to-have skills, deadline, link to original posting, match vs. draft profile | The **full AI analysis panel, save, and tailor are gated** with inline signup prompts. |

### D2. What requires an account (free)?

- Save a job (catalog or pasted own posting) → user's `job_postings`.
- Add own job posting (paste text).
- Full job analysis (AI JD extraction) — costs us money, needs identity.
- Application tracker (create/update/timeline) — **free**, it is the retention
  engine and costs ~nothing (Postgres rows).
- Master profile persistence + editing.
- Resume upload (PDF/DOCX) — file storage liability stays behind auth.
- Dashboard, calendar, insights, documents, settings.

### D3. What consumes credits (later, paid)?

- **AI resume tailoring**: 1 credit per tailoring session generation.
  Signup grants 2 free credits. When credits run out → upgrade prompt
  (student premium, CAD $6–12/mo per TECHNICAL_DESIGN.md).
- Export PDF/DOCX: free while in beta, candidate for premium later.
- Application tracking: **never metered** in MVP. Advertised as free.
- Rate-limit guardrails (not user-facing pricing): job saves capped
  generously (e.g., 100/term) via `usage_counters` purely as abuse protection;
  not advertised.

### D4. Guest draft storage

`localStorage` (not `sessionStorage` — surviving a tab close is the whole
point of a draft). Single versioned JSON document, key
`coopfinder.guest_draft.v1`. Contains only what the guest typed: school,
program, term, work auth, target roles, skills, experience/project entries.
**No resume files, no email, no name required in guest mode.** UI labels it
"Saved on this device only — create an account to keep it."

### D5. Guest → user migration

On first login/signup, if a local draft exists:

- **New account (empty profile):** migrate automatically in one server action —
  create `profiles` row, `master_profiles` + `master_profile_entries`.
  Guest-typed entries arrive `confirmed = true` (the user authored them
  directly; `confirmed = false` is reserved for machine-extracted entries from
  future resume parsing). Clear localStorage on success.
- **Existing account with data:** never silently merge. Show an import prompt
  ("Import the draft profile from this device? N entries") with
  import / discard choices.
- Migration is idempotent (guarded by a draft hash) so a refresh mid-flow
  cannot duplicate entries.

### D6. Route protection model (hybrid)

Do **not** blanket-protect `(app)/`. Middleware protects private prefixes
only: `/dashboard`, `/applications`, `/resumes`, `/settings`, `/documents`,
`/insights`, `/calendar`. `/jobs`, `/jobs/[id]`, and `/start` are public and
render guest or authed variants from session state. Gated **actions** inside
public pages (Save, Tailor, Full analysis) show inline value-first signup
prompts — never a bare redirect.

### D7. First-run route

`/start`. `/` redirects there for guests (until a marketing landing page
exists, at which point `/` becomes the landing and keeps `/start` as its CTA
target).

### D8. Login page shape

Separate, boring `/login` (email + Google per TECHNICAL_DESIGN.md) that
accepts `?next=` and `?reason=` params so gate prompts can say *why* the user
is here ("Log in to save this job"). Signup value messaging lives in the
**gate prompts and `/start`**, not on the login form. Returning users get a
fast, plain login.

### D9. Application tracking positioning

"Tracking is free." It appears in gate copy and future pricing pages as the
permanently free tier anchor. Rationale: retention + habit formation; the
paid surface is AI work (tailoring, later cover letters/interview prep),
not organization.

### D10. Credits representation

- Schema: `tailoring_credit_ledger` (append-only; `delta` +/-, `reason` in
  `signup_grant | tailor_use | purchase | admin_adjust`). Balance =
  `sum(delta)`. Writes are **server-only** (service role / definer function);
  users can only `select` their own rows. `usage_counters` stays for
  rate-limit metering, not entitlements.
- UX: credit count visible in the tailoring workspace Actions card
  ("2 credits left · tailoring uses 1"). Generation button disabled at 0 with
  an upgrade prompt. No dark patterns: show the count before the user starts.

---

## 3. Implementation Phases

Phases are sequential; each has acceptance criteria a coding agent can verify.
Frontend guest experience (Phase 3) deliberately lands *with* auth so the
gates have somewhere to send people.

### Phase 1 — Strategy in docs (this change)
Docs only. Decisions D1–D10 recorded; no code.
**Done when:** PRODUCT_STRATEGY.md exists; DESIGN.md §22, TECHNICAL_DESIGN.md
v2 section, HANDOFF.md, CHATGPT_DIRECTOR_CONTEXT.md updated consistently.

### Phase 2 — Schema completion (delta migration)
The initial migration (`202607090001_initial_mvp_schema.sql`) already covers
profiles/companies/job_postings/applications/timeline/master profile/resume
versions/usage_counters with RLS. Add a **delta migration**:
- `catalog_jobs` table, readable by `anon` + `authenticated` (only
  `is_active = true`), written only by service role. Seed 20–40 entries.
- `tailoring_credit_ledger` + signup grant mechanism (+2 on profile creation).
- Balance helper (view or definer function `tailoring_credit_balance()`).
**Done when:** migration applies cleanly; anon key can select active catalog
jobs and nothing else; ledger rows cannot be written with the anon/user key.

### Phase 3 — Auth + hybrid routing + guest experience
- Supabase auth (email + Google), `/login` with `next`/`reason` params.
- Middleware protecting only private prefixes (D6).
- `/start` guest onboarding (localStorage draft, client-side matching against
  catalog), guest variants of `/jobs` + catalog `/jobs/[id]`, inline gate
  prompts, guest topbar/sidebar states per DESIGN.md §22.
- Keep every existing mock screen working for authed users (mock data remains
  until Phases 4–6 swap it out).
**Done when:** a signed-out visitor can complete `/start`, see live match
counts, hit a gate on Save/Tailor, sign up, and land in the app; a signed-in
user never sees guest gates; private routes redirect guests to
`/login?next=...`.

### Phase 4 — Jobs CRUD + guest-to-user migration
- Jobs CRUD per CHATGPT_DIRECTOR_CONTEXT.md §12 (pasted postings, no scraping).
- "Save" on a catalog job copies it into the user's `job_postings`
  (`source_url` preserved, `extracted` prefilled from catalog fields).
- Guest draft migration server action (D5) wired into the post-signup flow.
**Done when:** draft entered as guest is visible in `/resumes/master` after
signup; catalog saves appear in `/jobs`; migration is idempotent and the
existing-account import prompt works.

### Phase 5 — Applications CRUD (free tracking)
Tracker + timeline persistence. No metering. Tracker counts derive from real
rows.
**Done when:** create-from-saved-job, status changes, notes/follow-ups
persist; free-tracking copy present.

### Phase 6 — Master profile & resume persistence
Master profile/entries CRUD (confirmed flag rules from D5), resume version
records, resume upload to private storage.
**Done when:** profile edits persist; entries carry confirmed state; uploads
land in private bucket with signed-URL access.

### Phase 7 — AI parser + tailoring with credits
Server-side JD extraction and tailoring per TECHNICAL_DESIGN.md pipeline
(structured outputs, source-ID citation, claim checking). Tailoring generation
decrements the ledger atomically **after** a successful generation; UI shows
balance; 0-balance state shows upgrade prompt.
**Done when:** tailoring consumes exactly 1 credit per generation, balance
can't go negative, failed generations don't burn credits, and the workspace
shows credit state per DESIGN.md §22.5.

---

## 4. Risks & Tradeoffs

| Risk | Severity | Mitigation |
|---|---|---|
| **Job-board drift.** A public jobs page invites "why so few jobs?" and repositions us against Indeed. | High | Label it "Starter catalog" everywhere; cap size; primary CTA on the page is "Add your own posting" (gated); never promise comprehensiveness. |
| **Catalog staleness.** Hand-curated postings expire; dead deadlines destroy trust fast. | High | `is_active` + deadline-based auto-hide (`deadline < today` filtered out); keep the set small enough to maintain weekly; show "Last checked" date. |
| **Guest data loss.** localStorage is wiped by browser cleanup / private mode / device switch. | Medium | "Saved on this device only" labeling; surface the save prompt right after the first value moment, not at the end. |
| **Migration conflicts.** Draft on device + existing account data. | Medium | Explicit import prompt, never silent merge (D5). |
| **Weaker guest matching quality.** Deterministic skill overlap is cruder than AI matching. | Low | It only needs to be honest and directionally useful; copy says "based on skill overlap". AI analysis is the paid-side upgrade, which is also a monetization story. |
| **One-time 2 credits may under-convert vs. recurring free credits.** | Low | Cheap to change (one ledger insert policy); revisit with real funnel data. |
| **Anon abuse of public pages.** | Low | Guests trigger zero AI/server-mutation paths; catalog reads are cacheable; nothing to farm. |
| **Curation legal posture.** | Low | In-house summaries, always link out, honor takedown requests, no scraping. |

Tradeoffs accepted: more upfront frontend work before "real" features
(guest mode + gates), a small permanent curation chore, and two sources of
jobs (catalog vs. user-pasted) that the Jobs UI must distinguish.

---

## 5. Product Acceptance Criteria (end state)

1. A first-time visitor reaches a useful screen in one click and is never
   shown a bare login wall.
2. A guest can build a draft profile and see match feedback within ~2 minutes,
   with zero AI calls made.
3. Every gate prompt states the concrete value of the account ("save this
   job", "keep this profile", "tailor with 2 free credits") — no generic
   "Sign up to continue".
4. Nothing a guest typed is lost on signup (draft migrates), and nothing is
   uploaded to a server before signup (verifiable: no network writes in guest
   mode beyond static fetches).
5. Eligibility/match language follows DESIGN.md §22.4 (no "eligible" as a
   flat claim, no outcome promises).
6. Application tracking works end-to-end with no meter and is described
   as free.
7. Tailoring credits: visible balance, 1 credit per generation, server-side
   enforcement, graceful 0-credit state.
