# PRODUCT_STRATEGY.md — Paste-a-Link Core Loop, Job Board + Intake, Product-Led Onboarding

> **Revision 2 — adopted 2026-07-09. Still current; do not create a new revision for implementation progress.**
> Implementation status last synchronized: **2026-07-13** (see §10, §10a, §12).
> Supersedes revision 1 (see git history).
> What changed in r2: the selling point centers on the **paste-a-link intake
> loop**, the starter catalog grows into a **moderated public job board** with
> user submissions, `/jobs` stays private ("My jobs") and `/board` becomes the
> public surface, and centralized GPT-5.6 routing + deterministic-PDF plans
> are added.
> Product-led onboarding, hybrid auth, credits, and free tracking carry over
> from r1 unchanged.
>
> **Read together with:** [DESIGN.md](DESIGN.md) §22–23,
> [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) "Board, Intake & Export v3",
> [HANDOFF.md](HANDOFF.md),
> [CHATGPT_DIRECTOR_CONTEXT.md](CHATGPT_DIRECTOR_CONTEXT.md), and
> [CODEX_SESSION_LOG.md](CODEX_SESSION_LOG.md).

---

## 1. The selling point

> **Found a role? Paste the link.** COOPfinder extracts the requirements,
> compares them to your profile, helps you tailor a reviewed resume, exports a
> clean PDF, and sends you back to the original application site to submit it
> yourself.

COOPfinder remains a **Canadian co-op application command center** — not a job
board, not an auto-apply bot, not a scraper. The paste-a-link loop is the core
motion; the tracker is where the work lives; the public board is a discovery
aid and top-of-funnel surface, never the identity of the product.

Hard constraints (unchanged, non-negotiable):

- **No auto-apply.** Applying always happens on the original site.
- **No scraping product.** A single user-directed fetch of a URL the user
  pasted is intake; bulk crawling is not. Fetched text is stored privately for
  that user only and is never republished.
- **No copied job descriptions on the public board.** Board entries carry
  in-house summaries + `source_url` link-outs only.
- **AI is reviewable, never invents experience, and match/eligibility
  language stays careful** (DESIGN.md §22.4, §23.6).

## 2. Two job surfaces, one distinction

| | **Public job board** (`/board`) | **My saved jobs** (`/jobs`) |
|---|---|---|
| Audience | Everyone (guests + users) | Owner only (auth) |
| Content | Approved, moderated entries: in-house summary, skills, term, deadline, `source_url` link-out | Full private record: raw pasted/fetched text, extraction, match, notes, status |
| Source | Founder-curated + **user submissions after admin approval** | Pasted link/JD, or "Save to my jobs" from the board |
| Statuses | `pending_review → approved / rejected`, then `archived / expired` | `saved → tailoring → ready → applied → oa → interview → offer / rejected` |
| Feeds | Guest match preview, discovery, SEO later | Matching, tailoring, tracking, export |

A submitted job can be **both**: it immediately becomes a private saved job
for the submitter (full value, no waiting), and *optionally* a
`pending_review` board candidate. Moderation only gates **public visibility**,
never the submitter's own use.

## 3. What changed vs. r1 / what stays

**Changed**
1. `/jobs` returns to the protected set (it is the private pipeline). Guests
   navigating to `/jobs` are redirected to `/board` — discovery, not a wall.
   (r1's dual-mode guest `/jobs` is dropped: signed-in users need discovery
   too, so the board must be its own route anyway.)
2. `catalog_jobs` evolves into **`board_jobs`** with a moderation lifecycle
   and user submissions (rename + columns; migration spec in
   TECHNICAL_DESIGN v3 §D).
3. `/start` gains the **paste-a-link hero** as its centerpiece (guest-stash
   behavior, §5 below).
4. New plans added: `job_intake_events`, extraction-confidence fallback,
   centralized GPT-5.6 routing, deterministic PDF export.

**Stays**
- Command-center positioning and every completed MVP screen.
- Product-led onboarding: value before identity; login = "save your progress".
- Hybrid auth model, `proxy.ts` matcher approach, `/login?next=&reason=`.
- Guest draft in `localStorage` (`coopfinder.guest_draft.v1`) + migration
  rules; deterministic (non-AI) guest matching.
- `tailoring_credit_ledger` (2 free credits at signup) and free, unmetered
  application tracking.
- All AI-safety and language rules.

## 4. Route model (decision)

| Route | Access | Purpose |
|---|---|---|
| `/` | public | authed → `/dashboard`; guest → `/start` |
| `/start` | public | paste-link hero + guest profile builder + match preview (§5) |
| `/board` | public | moderated job board (approved entries only) |
| `/board/[id]` | public | board detail: summary, skills, link-out; gated Save/Analyze |
| `/board/submit` | public page; submitting requires auth | suggest a role for the board (atomic private + pending-review creation, as built) |
| `/login` | public | plain login, `?next=&reason=` |
| `/jobs`, `/jobs/[id]` | **auth** | My saved jobs (existing MVP screens, unchanged); guest → redirect `/board` |
| `/dashboard`, `/applications(/**)`, `/resumes(/**)`, `/calendar`, `/insights`, `/documents`, `/settings` | auth | unchanged |
| `/admin/board` | admin only (later phase) | moderation queue; MVP moderation happens in Supabase Studio |

Sidebar adds **Job board** as a top-level item (visible to guests and users);
"Jobs" is relabeled **My jobs** for authed users.

## 5. `/start` after the redirect

Order of the page (single 720–960px column, DESIGN.md §22.2 + §23.3):

1. **Hero: paste input.** "Found a role? Paste the link or the job
   description." For guests, submitting does **not** run AI: the link/JD is
   stored in the device draft with the message *"We'll extract the
   requirements when you create your free account — this link is saved on
   this device."* The gate fires here with the concrete value line. For
   authed users, the same input goes straight to real intake in `/jobs`.
2. **Draft profile builder** (unchanged from r1): school/program/term, work
   auth, target roles, skills, experiences — all optional, device-only chip.
3. **Live match preview** against approved board jobs (deterministic skill
   overlap; zero AI): "6 roles on the board match your profile so far."
4. **Board CTA:** "Browse the job board" (public, no gate).
5. **Signup prompt** after the first value moment (non-zero matches or a
   stashed link): "Create a free account to save your profile and extract
   that posting — 2 free tailoring credits included."

Guest capabilities (complete list): browse `/board` and board details, build
the device draft, see deterministic match counts, stash pasted links/JDs in
the draft. Zero AI calls, zero server writes.

Login required for: intake extraction (URL fetch/AI), saving jobs (board or
pasted), submitting to the board, tracker, master profile persistence, resume
upload, tailoring (credits), export.

## 6. Job intake (paste link / JD)

One shared intake flow (component reused everywhere it appears):

- **Entry points:** `/jobs` "Add job" (primary), global topbar "Add job",
  `/start` hero (guest-stash variant), dashboard quick-action card.
- **Input:** URL *or* pasted description. If a URL is given, the server makes
  **one** fetch of that exact URL at the user's request. If the fetch is
  blocked, fails, or extraction confidence is low, the UI falls back to
  "Paste the job description instead" (DESIGN.md §23.4). Never retry-crawl.
- **Extraction:** GPT-5.6 Luna produces structured fields + per-field and
  overall confidence (TECHNICAL_DESIGN v3 §E). The user always reviews the
  extracted fields in an editable form before saving — extraction is a draft,
  not a fact.
- **Output:** a private `job_postings` row (`intake_source`:
  `pasted_url | pasted_text | board_save | manual`), which feeds matching,
  tailoring, and the tracker. Applying happens on `source_url`.
- **Board submission:** an opt-in checkbox in the intake success state
  ("Suggest this role for the public job board") and an action on the saved
  job detail. Creates a `pending_review` board row (§7).

## 7. Board moderation

- Submissions land as `board_jobs` rows with `status = 'pending_review'`,
  carrying `submitted_by`, `submitted_url`, and an optional note — **not**
  the user's raw pasted text.
- **MVP review = founder in Supabase Studio:** verify the link, write the
  in-house summary and skills, set term/deadline, flip to `approved` (or
  `rejected` with a note). A minimal `/admin/board` queue UI is a later
  phase (admin gate via `profiles.is_admin`).
- Public read policy exposes only `approved` rows with unexpired deadlines.
  Submitters can see their own rows' status ("Pending review" chip in their
  saved job detail). `archived` (manual) and `expired` (deadline-derived)
  remove entries from the board without deleting history.
- Duplicate control: GPT-5.6 Luna duplicate-candidate detection at submission time
  (same `source_url` host+path, or high title+company similarity) marks
  likely dupes for the reviewer.

## 8. Planned GPT-5.6 routing strategy

This is the permanent **planned architecture**, not an implemented
integration. No production AI call exists yet. Model selection will live in
one server-only configuration module; feature code will request a task
category or capability tier and will never hardcode a model identifier.

| Model | Planned responsibility | Hard boundary |
|---|---|---|
| **GPT-5.6 Luna** (`gpt-5.6-luna`) | Fast, schema-constrained JD cleanup, explicit field extraction, basic classification, lightweight normalization, and duplicate-candidate detection | Validated structured output only; never final resume content |
| **GPT-5.6 Terra** (`gpt-5.6-terra`) | Requirement normalization, hiring-signal analysis, confirmed-evidence mapping, directional match explanations, next actions, first-pass claim classification, and escalation judgment | Experience-backed conclusions use confirmed evidence only; never eligibility or outcome probability |
| **GPT-5.6 Sol** (`gpt-5.6-sol`) | Nuanced evidence selection, reviewable resume suggestions, supported rewriting, difficult claim disputes, and final semantic review | May reorganize or rephrase confirmed evidence, but never expand beyond it or invent a claim |

Default routing: Luna extracts and passes schema validation; invalid,
low-confidence, contradictory, or unclear output escalates to Terra. Terra
normalizes and maps requirements to confirmed Master Profile evidence.
Ambiguous evidence, high-impact wording, difficult claim disputes, and final
resume language escalate to Sol. Retries and escalations are bounded; failure
returns an honest review/manual state, never fabricated fallback content, and
never consumes a tailoring credit.

Every experience-backed suggestion retains source-evidence references and
supports accept, reject, or edit. AI cannot confirm evidence. Unsupported
claims block readiness and export. Final PDF rendering accepts reviewed
content only and prohibits AI calls. The canonical task routing table and
operational controls are in TECHNICAL_DESIGN.md §3 and v3 §F.

## 9. Deterministic PDF export

AI helps **create** reviewed content; it never touches the **render**.

- Export is available only when readiness passes: all suggestions reviewed,
  no unsupported claims outstanding, claim check passed.
- The accepted content (exact accepted/edited text, nothing else) is
  snapshotted with a content hash; the PDF renders server-side from a
  **versioned template** with **no AI call in the render path** and no new
  claims possible by construction.
- Same content + same template version ⇒ the same document. Export records
  store `template_version` + `content_hash` for auditability.
- Full pipeline: TECHNICAL_DESIGN v3 §G.

## 10. Implementation phases & status (synchronized 2026-07-13)

**Completed** (details and exact object names in TECHNICAL_DESIGN.md as-built
sections and HANDOFF.md):

| Phase | Status |
|---|---|
| 1. Docs redirect (strategy r2) | ✅ Done |
| 2. Schema delta v3 (`board_jobs` moderation, `job_intake_events`, intake columns, `profiles.is_admin`) — `202607090003_board_intake_export_v3.sql` | ✅ Done and applied to the development database |
| 3. `/start` v2 (paste hero with guest-stash, draft builder, deterministic match preview, gate after value; no AI, no fetching, no guest server writes) | ✅ Done |
| 4. Public board `/board` + `/board/[id]` (approved/active/unexpired reads, filters, guest match notes, link-outs, guest `/jobs` → `/board` redirect) | ✅ Done |
| 5. Public `/board/submit` page with an honest guest sign-in state and **authenticated atomic** private+pending creation (`submit_board_job_with_private_copy`, `202607120001_atomic_board_submission.sql`); submitter status labels (Pending review / On the board / Not added / Archived) | ✅ Done; guest zero-write gate and authenticated RPC behavior verified live |
| 6. Private saved-jobs CRUD on `/jobs` + `/jobs/[id]` (create/list/read/edit/delete, search/filters over persisted rows, board→private saves with duplicate prevention via `202607130001_unique_private_board_saves.sql`) | ✅ Done; two-user private-job RLS isolation verified live |
| 7. Master Profile Supabase persistence + authenticated guest-draft import (`save_master_profile`, `import_guest_draft`, `guest_draft_imports` ledger, `202607130002_master_profile_guest_import.sql` + forward-only repairs through `202607130006`) | ✅ Done; Master Profile persistence/rollback and guest-import normal, idempotent, canonical, concurrent, and existing-account merge behavior verified live |
| 8. Persisted Applications CRUD (`202607130007_applications_crud_foundation.sql` through `202607130014_atomic_application_deletion.sql`): atomic create, tracker/detail/timeline, status, notes, deadline, follow-up, delete, and recreate | ✅ Done and applied; authenticated isolation, concurrency, event contracts, saved-job preservation, browser flow, and no-Supabase states verified |

**Remaining product phases**, in order:

1. **AI job parser for pasted JD text.**
2. **Bounded, user-directed URL intake** with manual paste fallback.
3. **AI resume tailoring** with reviewable source evidence and the existing
   credit boundaries.
4. **Mechanical claim checker.**
5. **Deterministic PDF export.**
6. **Final MVP integration and end-to-end QA.**

Not done (do not document as complete anywhere): AI parsing, URL fetching,
extraction-confidence pipeline, production tailoring/credit consumption,
claim checker, PDF/DOCX export, file upload, moderation dashboard,
notifications, Calendar/Insights functionality.

## 10a. Live-verification status — current through Applications CRUD

The development Supabase project is connected and migrations through
`202607130014` are applied; migration `015` has not been created. Narrow live
checks have covered Master Profile
persistence and rollback; guest-import normal, sequential-idempotent,
canonicalized, concurrent, and existing-account `auto`/`merge` behavior;
two-user RLS for `job_postings`, `profiles`, `master_profiles`,
`master_profile_entries`, and `guest_draft_imports`; authenticated atomic board
submission; approved-board save/duplicate/privacy behavior; and production
route, sign-out, direct-HTTP, and public `/board/submit` behavior. Applications
checks cover atomic creation, persisted tracker/detail/timeline, status, notes,
deadline, follow-up, deletion/recreation, two-user and anonymous isolation,
concurrency, event contracts, and saved-job/unrelated-data preservation.

Do not generalize beyond those tables and flows. Guest-import post-write
rollback is conditionally complete rather than behaviorally passed: all
caller-controlled constraint-sensitive values are rejected before writes, and
later values are derived or fixed, so no safe deterministic post-write failure
exists without modifying production behavior. No such test hook was added.
This limitation is documented and did not block Applications CRUD.

## 11. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Job-board identity drift** — a real board with submissions pulls the product toward "small Indeed" | High | Board stays summary+link-out only; primary CTA everywhere is the intake loop; sidebar/board copy frames it as discovery for the command center |
| **Moderation bottleneck** — founder review doesn't scale; stale pending queue frustrates submitters | Med | Submitter gets full private value instantly (moderation gates publicity only); dedupe assist; expiry auto-hides stale entries; admin UI deferred until volume justifies it |
| **URL fetch legal/ToS exposure** — sites block or forbid fetching | Med | One user-directed fetch, honor blocks, immediate paste-fallback, fetched text private to owner, never republished; no crawling, ever |
| **Extraction quality erodes trust** | Med | Confidence thresholds + always-editable review form; low confidence routes to paste/manual; `job_intake_events` measures real-world accuracy |
| **Guest-stash disappointment** — user pastes as guest, expects instant magic | Low | Copy sets expectation at the input ("we'll extract when you create your account"); post-signup auto-processing makes good on it immediately |
| **Board content liability** — bad/spam submissions | Low | Nothing user-written goes public; admin authors all public text; rejected state + notes |
| **Model routing leaks** — model names hardcoded across features | Low | One server-only task router + env-backed Luna/Terra/Sol mapping; feature code requests capabilities, never model IDs |

## 12. One-week MVP scope (execution priority, not a strategy change)

The MVP core loop: **sign in → save a private job → enter trusted experience →
parse pasted JD → review evidence-backed resume suggestions → export a
deterministic PDF → return to the original site and apply manually.**

Already-implemented foundations: authentication, public/private job
separation, private Jobs CRUD, persisted Master Profile, evidence-confirmation
state, guest-to-account import, and persisted Applications CRUD.

Highest-priority remaining work, in order:

1. Pasted-text JD parsing.
2. A small number of evidence-linked resume suggestions.
3. Unsupported-claim blocking.
4. One deterministic PDF template.
5. End-to-end testing of the core loop.

Explicitly deprioritized for the one-week MVP (long-term direction unchanged):
moderation dashboard, broad URL intake, file upload, DOCX, Calendar/Insights
completion, drag-and-drop, advanced filters, notifications, model controls
exposed in the UI, extensive mobile redesign, automatic applying (never).

## 12a. Engineering traceability

Implementation continues through one narrow Codex prompt at a time; future
phase prompts are written when that phase begins, not stockpiled. Meaningful
core sessions are recorded in `CODEX_SESSION_LOG.md` with a sanitized task
summary, observable verification, and related commit range. A real
`/feedback` Session ID is copied exactly when available and is never invented,
inferred from Git history, or reconstructed later.

## 13. Product acceptance criteria (end state)

1. A guest can paste a link on `/start`, build a draft, see match counts, and
   understand exactly what an account unlocks — with zero AI calls and zero
   server writes until signup.
2. The paste→extract→review→tailor→export→"apply on the original site" loop
   works end-to-end for a signed-in user, with the user reviewing extraction
   fields and every resume suggestion.
3. The public board never shows unapproved content or copied job-description
   text; every entry links out; expired deadlines disappear automatically.
4. A submitter always keeps full private use of their job regardless of
   moderation outcome, and can see their submission status.
5. Match/seniority language follows DESIGN.md §22.4 + §23.6; no eligibility
   or outcome promises anywhere.
6. Tailoring consumes ledger credits exactly as specified; tracking stays
   free and unmetered.
7. Exported PDFs contain exactly the accepted content, render without AI, and
   are reproducible from their stored hash + template version.
