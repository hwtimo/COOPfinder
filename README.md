# COOPfinder

COOPfinder is a Canadian co-op application command center that converts job
requirements and confirmed student evidence into reviewable, job-specific
application materials without fabricating experience.

## AI Development Strategy

COOPfinder's planned AI architecture uses the GPT-5.6 family because it lets
the product route structured extraction, evidence analysis, and nuanced
resume assistance to distinct capabilities while keeping one trust model.
The integration is **planned, not implemented**:

- **GPT-5.6 Luna** (`gpt-5.6-luna`) performs fast, schema-validated JD cleanup,
  explicit extraction, classification, and duplicate-candidate detection. It
  never produces final resume content.
- **GPT-5.6 Terra** (`gpt-5.6-terra`) normalizes requirements, maps them to
  confirmed Master Profile evidence, produces directional explanations, and
  performs first-pass claim classification.
- **GPT-5.6 Sol** (`gpt-5.6-sol`) produces nuanced, evidence-backed resume
  suggestions and performs difficult or final semantic claim review without
  expanding beyond confirmed evidence.

Model IDs will be resolved in one server-only configuration module; feature
code requests a task category instead of hardcoding a model. Every resume
suggestion must identify confirmed source evidence and support accept, reject,
or edit. Human review is mandatory, unsupported claims block readiness, and
deterministic PDF rendering accepts reviewed content only with no AI call.

Meaningful Codex-assisted engineering work is recorded in
[`CODEX_SESSION_LOG.md`](CODEX_SESSION_LOG.md) using observable verification,
commit traceability, and real `/feedback` Session IDs when available. IDs and
verification evidence are never fabricated. Detailed routing and safety rules
live in [`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) §3.
