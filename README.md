# COOPfinder

COOPfinder is a Canadian co-op application command center that turns job
requirements and confirmed student evidence into reviewable, job-specific
application materials without fabricating experience.

## Current Status

Supabase-backed features:

- email/Google auth and hybrid public/private route protection;
- device-only `/start` guest draft and authenticated guest-draft import;
- moderated public board, board detail, and public `/board/submit` page with
  authenticated atomic submission;
- private saved-jobs CRUD and approved-board-to-private saves;
- persisted Master Profile, skills, ordered evidence, and confirmation state;
- persisted Applications tracker/detail/timeline with atomic create, status,
  notes, deadline, follow-up, delete, and recreate flows.

The development database has eighteen applied migrations through
`202607130014_atomic_application_deletion.sql`; migration `015` has not been
created. Applications CRUD has been live-verified for authenticated isolation,
concurrency, event contracts, saved-job preservation, and honest disabled
states. Guest-import post-write rollback remains the earlier conditional
limitation because its RPC has no safe caller-controlled later failure.

Still mock, local, partial, or unimplemented: Dashboard persistence,
Resume hub persistence, production tailoring, AI JD parsing, bounded URL
fetching, claim checking, PDF/DOCX export, file upload, Calendar, Insights,
Documents, notifications, and moderation UI. Tracker drag-and-drop, Table/
Calendar modes, resume attachment, and arbitrary timeline entries are also not
implemented.

The next product phase is the **AI job parser for privately pasted JD text**.
Its first narrow implementation task will be scoped separately; no AI parser
or migration `015` exists yet.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these application values in ignored `.env.local` without committing them:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

The remaining empty placeholders in `.env.example` support local Supabase CLI
work and must also remain secret when populated. Never commit `.env.local`.

Checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Product Boundaries

No automatic applying, crawling, blanket scraping, access-control bypass, or
publication of full private job-description text through `board_jobs`. Raw JD
stays private. Future AI suggestions must cite confirmed evidence, never invent
claims, remain accept/reject/edit reviewable, and use directional match
language without guaranteed eligibility or hiring outcomes. PDF rendering is
planned to be deterministic with no AI call in the render path.

Strategy Revision 2 remains canonical in
[`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md). As-built backend details live in
[`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md), current continuation guidance in
[`HANDOFF.md`](HANDOFF.md), and factual verification history in
[`CODEX_SESSION_LOG.md`](CODEX_SESSION_LOG.md).
