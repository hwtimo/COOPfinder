# ROADMAP.md — InternshipBC Post-Launch Improvement Plan

> **Status:** Adopted 2026-07-20. The r2 build-out phases in
> PRODUCT_STRATEGY.md are complete and the product is launched
> (internshipbc.dev). **This file is now the single source of "what to build
> next."** Completed-phase lists in other docs are history, not direction.
>
> **Doc roles from here on:**
> - `ROADMAP.md` (this file) — what's next, in order. Living.
> - `HANDOFF.md` + `TECHNICAL_DESIGN.md` — what exists (as-built). Living.
> - `PRODUCT_STRATEGY.md` — the product constitution (positioning, trust
>   boundary, hard lines). Its phase list is closed; do not extend it.
> - `CODEX_SESSION_LOG.md` — permanent session record. Continues.
> - `CHATGPT_DIRECTOR_CONTEXT.md` — superseded by ROADMAP + HANDOFF for
>   day-to-day work; keep only if still used for external director chats.
>
> **Working method unchanged:** one narrow Codex prompt at a time, one item
> per prompt, session-logged, live-verified.

---

## Hard lines (unchanged, apply to every item below)

- No auto-apply. Applying happens on the original site.
- No scraping/crawling. URL intake is at most **one user-directed fetch** of
  the exact pasted URL with manual-paste fallback.
- Evidence trust boundary: AI may only select/reference **confirmed**
  evidence; machine-extracted content always arrives **unconfirmed**; AI can
  never set `confirmed = true`.
- No fabricated or blended confidence numbers. Matched/unmatched counts over
  opaque scores.
- Deterministic export: no AI call in the render path.
- Credits: reserve → consume/refund; failed generations never burn credits.

---

## R1 — "Truth & Access" (P0: must fix first)

Goal: a real user can sign in once, stay signed in, and never see fake data
or another brand name. **Exit gate:** item R1-7.

### R1-1. Fix session persistence + add email/password sign-in
- Diagnose why sessions drop between visits. Prime suspects: Supabase Site
  URL / redirect-URL mismatch between `internshipbc.dev` and the
  `*.vercel.app` domain (cookies do not cross domains — if the OAuth/magic
  callback lands on the Vercel domain while the user browses the custom
  domain, the session "disappears"). Unify: one canonical domain, Supabase
  Site URL + additional redirect URLs set accordingly, all auth emails and
  callbacks pointing at the canonical domain only.
- Add **email + password** as a primary sign-in method (SMTP is already
  verified, so password reset emails work). Keep magic link as secondary.
- Accept: sign in on `internshipbc.dev`, close browser, return next day —
  still signed in. Password signup/login/reset all work on the custom domain.

### R1-2. Enable Google Sign-In
- Supabase Google provider + consent screen; button placed as the first
  option on `/login` (password second, magic link tertiary).
- Accept: fresh Google account can sign up and land on `/dashboard`;
  callback stays on the canonical domain.

### R1-3. Remove ALL mock data from production screens
- Kill Maya Chen and every mock fixture from user-facing rendering:
  Dashboard, Resumes hub, Calendar, Insights, Documents, Settings, and any
  shell fallback strings (`currentUser` in topbar/sidebar/layout).
- New users see honest empty states with one next action, per DESIGN.md §10.
- `lib/mock/` may remain in the repo for tests/dev only — nothing in a
  production route may import it. Add a lint guard or grep check in CI if
  cheap. A separate `/demo` space is OPTIONAL and only if we actually need
  demos; do not build it speculatively.
- Accept: `git grep` shows no production route importing `lib/mock`; a brand
  new account sees zero fabricated numbers anywhere.

### R1-4. Brand unification → **InternshipBC**
- One name everywhere: app metadata/titles, login screen, sidebar logo,
  auth emails, README, package name where visible, and the living docs.
- Accept: `grep -ri "coopfinder"` in user-facing strings returns nothing
  (repo/directory name may lag; that's cosmetic and optional).

### R1-5. Privacy Policy + Terms + Delete account  *(promoted from P2 — legal)*
- The product is live and processing real students' personal data, and JD /
  profile text is sent to OpenAI. Under PIPEDA this is now an obligation,
  not polish:
  - `/privacy` and `/terms` pages (plain language; state exactly what is
    sent to the AI provider, what is stored, and that AI training opt-in
    defaults to off).
  - **Delete account** in Settings: cascades all user rows (schema already
    cascades from `auth.users`) + storage objects; immediate hard delete.
- Accept: a user can read both pages logged out, and self-serve delete their
  account; deleted user's rows verifiably gone.

### R1-6. Minimal error monitoring  *(promoted from P2)*
- Post-launch we are blind without it. Sentry (or equivalent) for server
  actions/RPC failures + client errors. **No resume/JD bodies, no prompts,
  no personal data in events** — scrub before send.
- Accept: a thrown server-action error appears in the dashboard with route
  + status only.

### R1-7. Full real-user flow verification (exit gate)
- One fresh account, production: sign up → profile → add job (URL + pasted
  text) → analyze → match → tailor → print/PDF → track application →
  status changes → delete account.
- No mock copy, no test-only wording, no dead ends anywhere on the path.
- Log the pass in CODEX_SESSION_LOG.md. R2 does not start until this passes.

---

## R2 — "Focus" (P1: one screen, one job — Toss-inspired simplicity)

Design principle for all of R2: each page pushes exactly **one** primary
action. Density was right for the build-out; launched students need focus.

### R2-1. Dashboard → next-action hub
- Replace analytics-flavored dashboard with: (a) for new users, a 3–5 step
  onboarding checklist (profile → first job → first analysis → first
  tailor); (b) for active users, ONE primary CTA ("Review match for TELUS",
  "Deadline tomorrow: submit Shopify") + a short queue below.
- All numbers shown must be real counts from the user's own rows.

### R2-2. Remove unfounded metrics
- Delete "Estimated callback rate" everywhere.
- Delete the legacy `job.matchScore` "Estimated match" block on Job Detail
  (already flagged: it predates the deterministic matcher and contradicts
  it). The explainable Profile Match card is the only match surface.
- Replace any remaining blended percentages with matched/not-evidenced
  counts per category.

### R2-3. Master Profile onboarding via resume upload
- Upload existing resume PDF → deterministic text extraction (`unpdf`;
  scanned PDFs fail honestly, no OCR) → AI drafts profile/evidence entries.
- **Every extracted entry arrives `confirmed = false`.** The user confirms
  entry-by-entry (existing trust boundary; the AI-parsed path is exactly
  what the unconfirmed state was reserved for).
- Goal: minimize typing before the first real match.

### R2-4. URL auto-analysis (bounded single fetch)
- When a job is added by URL, offer "Fetch and analyze": ONE server-side
  fetch of that exact URL, no redirect chasing beyond same-site, no retry
  crawl, honor blocks; on failure fall back to the existing manual-paste
  path (already built). Fetched text goes only to the owner's `raw_text`.
- Extension/bookmarklet/import: explicitly OUT of scope for R2 — revisit
  only after fetch-success telemetry (`job_intake_events`) says it's needed.

### R2-5. Tailored resume editing
- On a generated version: remove bullets, reorder, edit wording.
- The generated original stays **immutable**; edits save as a NEW version
  linked to its parent. Edited content is user-authored (no claim-check
  regression: user edits are the user's own statements).

### R2-6. Application tracker simplification
- Create an application in one click from Job Detail; auto-link the resume
  version used; one-click status advance; deadline / interview / follow-up
  dates inline.

### R2-7. AI operation status UX
- Analyze/Generate show stepped progress (not a bare spinner), failure
  states show the reason AND whether the credit was refunded (reservation
  states already exist — surface them), and in-flight dedupe is explained
  ("Already generating — this won't use another credit").

---

## R3 — "Polish & Revenue" (P2)

### R3-1. Design-system refresh (Toss-inspired)
- Adopt the *principles*: one goal per screen, generous whitespace, fewer
  cards/tables, one obvious CTA, calm student-friendly tone.
- ⚠️ **License warning:** TDS (Toss Design System) components, Figma UI kit,
  and graphic assets are licensed **only for App-in-Toss partner services**.
  We may take inspiration from publicly visible principles; we may NOT use
  TDS components, tokens, or assets. Implementation stays on our own
  tokens + shadcn/ui.

### R3-2. Mobile pass
- Wide tables → mobile cards; status changes and deadlines usable
  one-handed.

### R3-3. Empty-state upgrade
- Every empty state names the next action with one CTA (extend R1-3 work).

### R3-4. E2E tests + analytics
- Playwright: login/callback, cross-user isolation, analyze, tailor,
  print/PDF, delete account. Privacy-safe product analytics (no bodies).

### R3-5. Stripe
- Prerequisites (blockers): unit economics for credits at real GPT-5.6
  pricing (still an open number — decide free grant vs paid pack pricing
  from actual per-generation cost), refund policy text, and R1-5 legal
  pages. Only then: checkout for credit packs / subscription.

### R3-6. Data export (review)
- User-initiated export of their own data (PIPEDA access-request
  friendliness). Scope after R3-4.

---

## Sequencing rules

1. R1 items land in order 1→7; R1-7 gates R2.
2. Within R2/R3, items are independent unless noted (R3-5 depends on R1-5).
3. Every item = one narrow Codex prompt + session log entry + live check.
4. Docs: each shipped item updates HANDOFF §1 (as-built) in the same PR;
   this file flips the checkbox. No other doc grows a new phase list.

## Checklist

- [x] R1-1 session persistence + password auth
- [ ] R1-2 Google sign-in
- [ ] R1-3 mock data removal
- [ ] R1-4 InternshipBC branding
- [ ] R1-5 privacy / terms / delete account
- [ ] R1-6 error monitoring
- [ ] R1-7 full-flow exit gate
- [ ] R2-1 next-action dashboard
- [ ] R2-2 unfounded metrics removal
- [ ] R2-3 resume-upload onboarding
- [ ] R2-4 bounded URL auto-analysis
- [ ] R2-5 tailored resume editing
- [ ] R2-6 tracker simplification
- [ ] R2-7 AI status UX
- [ ] R3-1 design refresh (Toss-inspired, own tokens)
- [ ] R3-2 mobile pass
- [ ] R3-3 empty states
- [ ] R3-4 E2E + analytics
- [ ] R3-5 Stripe (after economics + legal)
- [ ] R3-6 data export
