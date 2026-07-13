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
- persisted Master Profile, skills, ordered evidence, and confirmation state.

The development database has ten applied migrations through
`202607130006_fix_save_master_profile_coalesce.sql`. The pre-Applications live
verification gate is complete. Guest-import post-write rollback is the one
conditional limitation: the RPC has no safe caller-controlled failure after
its pre-write validation, so no production test hook was added.

Still mock, local, partial, or unimplemented: Dashboard persistence,
Applications CRUD and timeline, Resume hub persistence, production tailoring,
AI JD parsing, bounded URL fetching, claim checking, PDF/DOCX export, file
upload, Calendar, Insights, Documents, notifications, and moderation UI.

The next task is the Applications CRUD database foundation. Its planned next
unused migration is `202607130007_applications_crud_foundation.sql`; that file
does not exist yet.

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

No automatic applying, crawling, or republishing private job-description text.
Future AI suggestions must cite confirmed evidence, remain accept/reject/edit
reviewable, and never imply guaranteed eligibility or hiring outcomes. PDF
rendering is planned to be deterministic with no AI call in the render path.

Strategy Revision 2 remains canonical in
[`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md). As-built backend details live in
[`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md), current continuation guidance in
[`HANDOFF.md`](HANDOFF.md), and factual verification history in
[`CODEX_SESSION_LOG.md`](CODEX_SESSION_LOG.md).
