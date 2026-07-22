# COOPfinder

COOPfinder is a Canadian co-op application command center that turns private
job requirements and confirmed student evidence into reviewable, job-specific
application materials without fabricating experience.

## Current MVP boundary

The technical MVP includes Supabase-backed authentication, private jobs,
manual job-text analysis, deterministic Profile Match, a Master Profile with
approved resume evidence, application tracking, credit-safe tailoring,
immutable tailored-resume versions, and browser Print/Save as PDF.

Saving a job URL does **not** fetch it. The URL is normalized and stored; the
owner must paste the job description before Analyze becomes available. Job
matching is deterministic exact matching, not an eligibility decision, and no
overall score is shown.

## Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

Keep `.env.local` ignored. Never commit credentials or copy production data
into local fixtures.

Routine checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Beta deployment runbook

### Hosting target

The application is a standard Next.js 16 Node deployment. It has no custom
Docker, Netlify, Fly, Render, or Vercel configuration. Vercel is the preferred
beta target because it runs the repository's standard build command. Production
authentication URLs use the canonical `https://internshipbc.dev` origin rather
than forwarded request-host metadata. A conventional
Node host is also supported if it runs behind a trusted HTTPS reverse proxy and
preserves the original `Origin`, `Host`, `X-Forwarded-Host`, and
`X-Forwarded-Proto` values.

Build and start commands:

```bash
npm ci
npm run build
npm run start
```

The production build is `next build --webpack`. Use the hosting platform's
normal Next.js preset; no static export is supported.

### Environment-variable checklist

Use variable names only in tickets, logs, and review artifacts. Store values in
the hosting platform's encrypted environment store.

Public browser-safe values required at build and runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` — set to `https://internshipbc.dev`

Server-only secrets required by production runtime:

- `SUPABASE_SECRET_KEY`
- `OPENAI_API_KEY` — required only when live providers will be enabled

Server-only provider controls required by production runtime:

- `OPENAI_LIVE_PROVIDER_ENABLED` — deploy as `false` initially
- `OPENAI_MODEL_JOB_EXTRACTION` — set to `gpt-5-mini`
- `OPENAI_MODEL_TAILORING` — set to `gpt-5-mini`
- `GOOGLE_AUTH_ENABLED` — keep `false` until Google OAuth is fully configured

Operator/CLI-only values, not application runtime values:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

Never prefix a secret or provider control with `NEXT_PUBLIC_`. Never expose
`SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, database credentials, or CLI access
tokens to browser code. Preview deployments must not receive production
server-only secrets unless they are explicitly trusted.

### Exact deployment order

1. Choose the production domain and create a dedicated production Supabase
   project. Do not promote or reuse the linked development project as
   production.
2. Install the Supabase CLI outside the application dependency graph, log in,
   and link the repository to the production project:

   ```bash
   supabase login
   supabase link --project-ref <production-project-ref>
   supabase migration list
   supabase db push --dry-run
   ```

3. Review the dry run, take the provider-appropriate backup/snapshot, then
   apply the repository's 32 migrations in order through
   `20260721164946_harden_public_function_execution_acl.sql`:

   ```bash
   supabase db push
   supabase migration list
   ```

   Do not use `--include-seed`, `db reset --linked`, migration repair, or a
   history rewrite against production. Local and remote timestamps must match
   exactly before continuing.
4. Run Supabase Security Advisor. Migration
   `20260721164946_harden_public_function_execution_acl.sql` removes anonymous
   execution from the legacy board RPC and owner-scoped credit-balance RPC.
   Confirm those anonymous findings remain absent and resolve every other
   unexpected externally callable `SECURITY DEFINER` function before public
   traffic. Authenticated owner-scoped RPCs may remain callable only where
   their body enforces `auth.uid()` ownership.
5. Complete the Supabase Auth, SMTP, RLS, and API checklist below.
6. Create a dedicated OpenAI production project and complete its checklist.
   Keep `OPENAI_LIVE_PROVIDER_ENABLED=false`.
7. Configure the hosting environment, deploy the exact reviewed Git commit,
   and run the provider-disabled smoke checklist.
8. Only after the disabled smoke passes, run one controlled synthetic provider
   canary. Enable the live-provider switch for the canary window, perform at
   most one extraction and one tailoring generation, inspect usage and ledger
   state, and disable the switch immediately if any invariant fails.
9. For an invite-only beta, enable the switch only after the canary passes and
   alerts are active. Monitor the first requests and retain the ability to set
   the switch back to `false` immediately.

### Supabase production checklist

Production site:
`https://internshipbc.dev`

Production auth callback:
`https://internshipbc.dev/auth/callback`

- Use a dedicated production project and confirm all 32 migration timestamps
  match the repository.
- Set Auth **Site URL** to `https://internshipbc.dev`.
- Add the exact callbacks `https://internshipbc.dev/auth/callback` and
  `http://localhost:3000/auth/callback` to **Redirect URLs**. Remove Vercel
  deployment callbacks. Do not use a
  wildcard for the canonical production domain.
- The application starts email/OAuth login with that callback and the route
  exchanges the returned authorization `code` using
  `exchangeCodeForSession`. PKCE links are single-use, expire quickly, and must
  be opened in the same browser/device context that initiated the request.
- Configure Mailtrap **Email Sending**, not Email Sandbox. Verify a sending
  domain under `internshipbc.dev`, use its production SMTP credentials in
  Supabase Auth, and use an address on that domain as the sender. Disable link
  tracking that rewrites confirmation links, then test delivery, spam
  placement, expiry, and one-time-use behavior. Supabase's shared default
  sender and Mailtrap Sandbox are not production delivery services.
- Enable email/password signup and email confirmation. Ensure signup,
  magic-link, and reset-password templates use Supabase's
  `{{ .ConfirmationURL }}` (or the documented `SiteURL`, `TokenHash`, and
  `RedirectTo` variables) rather than a hardcoded hostname. Verify the final
  confirmation link returns to `https://internshipbc.dev/auth/callback`.
- Configure Auth rate limits appropriate for the beta and monitor email-send,
  verification, and token-refresh failures.
- Confirm RLS is enabled for every exposed table and that browser access uses
  only the anon/publishable client credential plus the authenticated user's
  cookie session.
- Keep `SUPABASE_SECRET_KEY` server-only. The trusted tailoring reservation,
  refund, and finalization RPCs must remain executable only through the
  service-role boundary; browser roles must not gain execution rights.
- Review explicit Data API grants as well as RLS. Supabase now treats grants
  and RLS as separate controls, and new projects may not expose new tables by
  default.
- Run Security Advisor after migration application and after every future
  schema release.

Google OAuth remains opt-in. To enable it later, create a Google Cloud OAuth
web client, configure its consent screen, and add the Supabase callback
`https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect
URI. Then enter the client ID and client secret under Supabase Auth's Google
provider, enable that provider, add the application callback URL to Supabase's
redirect allow list, set `GOOGLE_AUTH_ENABLED=true` in the server hosting
environment, and redeploy. Do not enable the application flag before the
Supabase provider has valid credentials.

References:

- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)

### Production-domain operations

- Assign `internshipbc.dev` to the Vercel production deployment and confirm
  Vercel has issued its HTTPS certificate before changing the Supabase Site
  URL. Add `NEXT_PUBLIC_SITE_URL=https://internshipbc.dev` to the Vercel
  Production environment and redeploy so canonical metadata uses the custom
  origin.
- Configure `www.internshipbc.dev` explicitly if it will be published. Prefer
  a Vercel domain-level redirect from `www.internshipbc.dev` to
  `internshipbc.dev`; do not leave both hosts serving independent canonical
  pages.
- Configure every `*.vercel.app` deployment host to redirect to
  `https://internshipbc.dev` at the Vercel domain layer. Do not use a Vercel
  deployment as an alternate authentication identity domain.
- In Supabase Dashboard, open **Authentication → URL Configuration**, set the
  Site URL and the two exact callbacks listed above, then inspect
  **Authentication → Email Templates** for hardcoded localhost or Vercel
  hosts. Template links must use Supabase variables so the requested PKCE
  redirect is preserved.

### OpenAI production checklist

- Use a dedicated COOPfinder production project and a project-scoped key; do
  not reuse a personal or unrelated-project key.
- Restrict the key and project to the API/model access required by the two
  Responses API adapters where the dashboard permits it.
- Set both task-specific model variables to `gpt-5-mini`. The application has
  no fallback to an unspecified model.
- Keep `OPENAI_LIVE_PROVIDER_ENABLED=false` through database migration,
  deployment, authentication smoke testing, and read-only product smoke
  testing. A missing or non-exact value fails closed before client creation.
- Configure project model permissions and conservative rate limits. Configure
  monthly budget alerts below and at the intended beta ceiling, and monitor the
  Usage dashboard. OpenAI project budgets are alerting thresholds, not a hard
  spending stop; the application kill switch is the emergency stop.
- Preserve the adapters' one-request behavior: `store:false`, zero SDK retries,
  30-second timeout, 4,096 extraction output tokens, and 2,048 tailoring
  output tokens.
- Preserve database attempt limits, idempotent replay, append-only credit
  events, refund behavior, and atomic tailored-document persistence. Failed or
  refunded paid attempts still count toward cost containment.
- Provider diagnostics may contain only adapter name, sanitized category,
  validated HTTP status, and sanitized request ID. Never log prompts, job text,
  profile/resume content, response bodies, headers, keys, or user identifiers.

References:

- [OpenAI API key quickstart](https://platform.openai.com/docs/quickstart/make-your-first-api-request)
- [OpenAI project keys, budgets, and limits](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)
- [OpenAI rate-limit practices](https://help.openai.com/en/articles/6891753)

### Provider-disabled production smoke

Use two disposable beta users and synthetic content. Clean them up afterward.

- Create a fresh email/password account through production SMTP; verify email
  confirmation, password login, logout, reset-email delivery, reset completion,
  PKCE exchange, refresh persistence, and denial of private routes after logout.
  Then verify the secondary magic-link flow independently.
- Verify User B cannot open or infer User A's Master Profile, jobs,
  applications, matching, tailoring, or resume-version routes.
- Save a Master Profile, candidate evidence, and one approved resume fragment.
- Create URL-free private jobs using synthetic manually pasted text.
- With the live-provider switch still `false`, verify Analyze and Generate fail
  closed with no OpenAI request, provider attempt, reservation, or credit
  consumption.
- Verify the unanalysed-job, empty-match, application-tracking, and tailoring
  unavailable states without inserting extraction fixtures or adding a test
  bypass to production.
- Confirm a new user receives exactly one tailoring credit and read-only
  navigation does not change it.
- Confirm no external source URL is fetched or opened by the application.
- Confirm generic user errors reveal no SQL, stack trace, raw extraction, job
  text, profile prose, owner identifier, token, or secret.

### Controlled live canary

After the disabled smoke and dashboard checks pass:

1. Use one disposable user and synthetic job/profile content.
2. Record credit, reservation, event, attempt, and resume-version baselines.
3. Set the live-provider switch to `true` and restart/redeploy so the server
   runtime receives it.
4. Submit exactly one extraction. Stop without retrying if it fails.
5. Verify the persisted extraction, individual Profile Match, `/jobs/matches`,
   application tracking/idempotency, workflow links, and tailoring preflight.
6. Only after those checks succeed, submit exactly one tailoring generation.
7. Confirm one provider attempt per adapter, credit `1 -> 0`, consumed
   reservation, one complete immutable v2 version, and no duplicates after
   refresh/revisit.
8. Review the immutable resume and browser Print/Save as PDF, sanitized
   provider diagnostics, and the OpenAI Usage dashboard.
9. Restore the switch to `false` immediately after the canary unless the
   release owner explicitly opens the beta, then clean up all fixtures.

### Monitoring and release-critical observability

Already available:

- hosting stdout/stderr for safe server-action and provider diagnostics;
- Supabase Auth, API, and Postgres logs plus Security Advisor;
- append-only parser/tailoring reservation and lifecycle event tables;
- OpenAI project Usage dashboard, model limits, and budget alerts;
- SMTP provider delivery/bounce dashboards.

Before enabling live providers, configure the hosting platform to retain and
alert on repeated `[openai-provider]` categories, server-action failures, and
unexpected process crashes. Configure OpenAI budget alerts and SMTP delivery
alerts. This MVP has no integrated APM or error-aggregation service; platform
log retention and dashboard alerts are the minimum beta requirement. Do not
send private job/profile/resume content to monitoring systems.

### Emergency shutdown and rollback

Provider emergency shutdown:

1. Set `OPENAI_LIVE_PROVIDER_ENABLED=false` in the production hosting
   environment.
2. Restart or redeploy all server instances and verify Analyze/Generate fail
   closed before declaring shutdown complete.
3. Check OpenAI usage, Supabase attempts/reservations/events, and credit ledger
   for in-flight work. Do not manually rewrite append-only ledger history.
4. If key exposure is suspected, revoke/rotate the project key, update the
   encrypted host secret, and keep the switch off until verification passes.

Application rollback:

1. Redeploy the last verified Git commit using the same environment values,
   with the provider switch off.
2. Do not roll back or delete applied production migrations and do not reset
   the production database. Use a separately reviewed forward migration for a
   schema defect.
3. Re-run callback, owner-isolation, provider-disabled, and credit-integrity
   checks before reopening traffic.
4. For an Auth/SMTP incident, keep the provider switch off, preserve existing
   data, correct the dashboard/provider configuration, and repeat PKCE smoke
   testing. Never introduce an authentication bypass.

### Known non-blocking MVP limitations

- URL intake stores a normalized URL but performs no fetch, DNS lookup, HTML
  parsing, scraping, redirect traversal, or job-board adaptation.
- Manual pasted text remains the only job-analysis input.
- Matching is exact and deterministic. Education, experience,
  responsibilities, and unsupported categories may remain unassessed; there
  is no overall score or hiring/eligibility verdict.
- Resume export uses browser Print/Save as PDF; there is no dedicated DOCX or
  server-generated download.
- Provider diagnostics are intentionally sanitized and do not retain response
  content because requests use `store:false`.
- The repository does not include a durable automated browser E2E suite or an
  integrated APM product; beta operations rely on the smoke checklist and
  platform dashboards.

## Product and engineering references

Strategy Revision 2 remains canonical in
[`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md). As-built backend details live in
[`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md), continuation guidance in
[`HANDOFF.md`](HANDOFF.md), and factual verification history in
[`CODEX_SESSION_LOG.md`](CODEX_SESSION_LOG.md).

No automatic applying, blanket scraping, access-control bypass, or publication
of private job-description text is allowed. User-confirmed evidence is the
trust boundary for generated materials.
