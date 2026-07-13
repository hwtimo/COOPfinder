# COOPfinder — V1 기술 설계 문서

> **포지셔닝:** SFU/UBC/Waterloo engineering & CS 학생용 co-op application OS
> **V1 범위:** Job save · Resume upload → master profile · AI resume tailor · Application tracker
> **작성일:** 2026-07-08

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────┐
│  Next.js (App Router, Vercel)                           │
│  ├─ UI: Tailwind + shadcn/ui + Framer Motion            │
│  ├─ Server Actions / Route Handlers  ←── 모든 AI 호출은  │
│  │                                        서버에서만     │
│  └─ Supabase JS client (RLS 하에서 직접 CRUD)            │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
     ┌─────────▼─────────┐   ┌────────▼────────────┐
     │  Supabase          │   │ Planned AI gateway  │
     │  ├─ Postgres (RLS) │   │ ├─ GPT-5.6 routing  │
     │  ├─ Auth           │   │ ├─ validation       │
     │  └─ Storage        │   │ └─ safe escalation  │
     └────────────────────┘   └─────────────────────┘
```

**원칙:**
- AI 호출과 파일 파싱은 전부 서버 사이드 (API key 노출 방지, 사용량 제한 강제).
- DB 접근은 Supabase RLS로 사용자별 격리 — 서버 코드 버그가 있어도 다른 유저 데이터가 안 새는 마지막 방어선.
- V1에는 별도 queue worker 불필요. tailoring은 스트리밍으로 동기 처리 (30초~2분). 나중에 batch 기능이 필요해지면 그때 Supabase Edge Functions + pg_cron 또는 QStash 추가.
- Meaningful Codex-assisted architecture, security, migration, and release
  work is recorded in [CODEX_SESSION_LOG.md](CODEX_SESSION_LOG.md) using one
  narrow task at a time, observable verification, commit traceability, and
  real `/feedback` Session IDs only.

---

## 2. 데이터 모델 (Postgres / Supabase)

계획서의 데이터 모델 중 V1에 필요한 것만. `Skill`, `Reminder`, `Source`는 V2로 미룸 (skills는 일단 JSONB로 profile 안에 저장).

```sql
-- 사용자 프로필 + 동의 플래그 (auth.users는 Supabase가 관리)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  school text check (school in ('SFU','UBC','Waterloo','Other')),
  program text,                    -- e.g. 'Computing Science'
  grad_year int,
  ai_training_opt_in boolean not null default false,  -- 별도 opt-in, 기본 false
  created_at timestamptz not null default now()
);

-- 업로드된 원본 이력서 파일 메타데이터
create table resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  storage_path text not null,      -- Supabase Storage 경로
  file_name text not null,
  mime_type text not null,         -- application/pdf | docx
  parsed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 파싱 결과 = master profile (사용자의 전체 경력/기술 pool)
-- "사용자가 본인의 모든 경력·기술을 다 적으면 tailor할 때 골라 쓴다"의 저장소
create table master_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  data jsonb not null,             -- 아래 MasterProfile 스키마
  updated_at timestamptz not null default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  created_at timestamptz not null default now(),
  unique (name)
);

-- 사용자가 저장한 공고 (Phase 1: user-fed)
create table job_postings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  company_id uuid references companies,
  title text not null,
  source_url text,
  raw_text text not null,          -- 붙여넣은 원문 (사용자 삭제 시 함께 삭제)
  extracted jsonb,                 -- 아래 JobExtraction 스키마
  created_at timestamptz not null default now()
);

-- tailoring 결과물 (버전 이력)
create table resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_posting_id uuid not null references job_postings on delete cascade,
  content jsonb not null,          -- tailored resume 구조체
  keyword_report jsonb,            -- matched / missing keywords
  export_path text,                -- 생성된 PDF의 Storage 경로 (nullable)
  created_at timestamptz not null default now()
);

-- application tracker (kanban)
create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_posting_id uuid not null references job_postings on delete cascade,
  -- DESIGN.md §8.5 kanban 컬럼과 일치 (+ CS co-op 특성상 'oa' 추가)
  status text not null default 'saved'
    check (status in ('saved','tailoring','ready','applied','oa','interview','offer','rejected')),
  deadline date,
  applied_at date,
  notes text,
  sort_order real not null default 0,   -- kanban 컬럼 내 순서
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- free tier 사용량 집계
create table usage_counters (
  user_id uuid not null references auth.users on delete cascade,
  period text not null,            -- 'YYYY-MM'
  tailor_count int not null default 0,
  primary key (user_id, period)
);
```

**RLS:** 모든 테이블에 `user_id = auth.uid()` 정책 (companies는 read-all / insert-authenticated). `usage_counters`는 클라이언트 write 금지 — 서버(service role)만 증가시킴.

**삭제 요구사항 구현:** 모든 사용자 데이터가 `auth.users`에 `on delete cascade`로 걸려 있으므로 계정 삭제 = 전체 데이터 삭제. Storage 파일(원본 이력서, export PDF)은 DB에 경로가 있으므로 삭제 route handler에서 Storage 객체를 먼저 지우고 row를 지운다. 개별 이력서/생성본 삭제 버튼도 동일한 핸들러 재사용.

### MasterProfile JSON 스키마 (핵심)

```typescript
interface MasterProfile {
  contact: { name: string; email: string; phone?: string;
             linkedin?: string; github?: string; website?: string };
  education: Array<{ id: string; school: string; program: string;
                     start: string; end?: string; gpa?: string;
                     coursework?: string[] }>;
  experiences: Array<{
    id: string;                    // tailoring 출처 추적용 — 중요
    type: 'work' | 'coop' | 'project' | 'volunteer' | 'club';
    title: string; organization?: string;
    start?: string; end?: string;
    bullets: string[];             // 사용자가 쓴 원본 bullet 전체
    skills: string[];              // 이 경험에서 쓴 기술
  }>;
  skills: { languages: string[]; frameworks: string[];
            tools: string[]; other: string[] };
}
```

`experiences[].id`가 anti-hallucination의 핵심이다 (§4.3).

---

## 3. Planned AI pipeline: GPT-5.6

> **Status:** architecture only. No OpenAI SDK, API call, model router, JD
> parser, tailoring generation, claim checker, or AI export step is currently
> implemented. All future provider calls run server-side.

### 3.1 Centralized model configuration

One planned server-only module, such as `lib/ai/model-config.ts`, owns model
resolution. Feature modules request a task category or capability tier; they
must never contain a model identifier. This keeps model replacement, quality
tuning, and cost controls out of product code.

Planned configuration names (documentation examples only; no values and not
presently required by the application):

```text
OPENAI_API_KEY=
OPENAI_MODEL_LUNA=
OPENAI_MODEL_TERRA=
OPENAI_MODEL_SOL=
```

| Capability | Planned model | Responsibility | Hard boundary |
|---|---|---|---|
| `luna_structured` | `gpt-5.6-luna` | Fast JD cleanup, explicit field and named-skill extraction, basic classification, duplicate candidates, lightweight normalization | Schema-constrained output only; never final resume content |
| `terra_analysis` | `gpt-5.6-terra` | Requirement normalization, hiring signals, confirmed-evidence mapping, missing/weak evidence, seniority mismatch, directional explanations, next actions, first-pass claim classification | Experience-backed conclusions use confirmed evidence only; no eligibility or hiring probability |
| `sol_review` | `gpt-5.6-sol` | Nuanced evidence selection, reviewable bullet suggestions, supported rewriting, ambiguous mappings, difficult claim disputes, final semantic review | May reorganize or rephrase confirmed evidence; may never expand beyond it or invent facts |

### 3.2 Routing and escalation

Default flow:

1. Luna performs initial structured extraction.
2. The server validates Luna output against the task schema and deterministic
   field rules.
3. Invalid schema, low confidence, contradictory fields, or unclear
   requirements escalate once to Terra.
4. Terra normalizes requirements and maps them to confirmed Master Profile
   evidence.
5. Ambiguous evidence, high-impact wording, difficult claim disputes, and
   final resume language escalate once to Sol.
6. Every user-facing suggestion stays reviewable regardless of model.
7. Model failure produces an honest retry/manual-review state, never invented
   fallback content.
8. A failed generation writes no negative credit-ledger entry.
9. Every experience-backed suggestion retains supporting evidence IDs.
10. AI output can never set evidence `confirmed = true`.
11. Unsupported claims block readiness and export.
12. PDF rendering is deterministic and contains no AI call.

| Task | Default model | Escalation condition | Output validation | User review requirement |
|---|---|---|---|---|
| JD cleanup | GPT-5.6 Luna | Text remains malformed, contradictory, or unusable | Length/content bounds; preserve source meaning | Review occurs with extracted fields |
| Structured JD extraction | GPT-5.6 Luna | Schema invalid, required fields missing, low confidence, or contradictions | Strict structured schema plus deterministic URL/date/enum checks | User edits and confirms before save |
| Requirement normalization | GPT-5.6 Terra | Ambiguous or conflicting requirements | Allowed categories: required, preferred, behavioural, contextual; source spans retained | User can inspect original requirement |
| Requirement-to-evidence mapping | GPT-5.6 Terra | Weak, conflicting, or high-impact mapping | Every match references an existing confirmed evidence ID | User reviews each mapping used in a suggestion |
| Directional match explanation | GPT-5.6 Terra | Nuanced conflict or uncertain evidence | Banned outcome language; confirmed-evidence references; missing evidence remains explicit | Clearly labeled estimate; user review required |
| Resume suggestion generation | GPT-5.6 Sol | Sol is already the quality tier; failure returns no suggestion | Structured suggestion, before/after text, source evidence IDs, claim checks | Accept, reject, or edit each suggestion |
| Unsupported-claim classification | GPT-5.6 Terra | Ambiguous wording or disputed/high-impact claim | Deterministic source-ID check plus allowed claim-status enum | Flagged claims require user resolution |
| Final semantic claim review | GPT-5.6 Sol | No further model escalation; failure blocks readiness | Accepted content checked against confirmed evidence and unresolved-claim count | User reviews final warnings before readiness |
| PDF rendering | **None**; AI call prohibited | No escalation; fail closed if readiness preconditions are unmet | Accepted and reviewed content only; content hash and template version | User explicitly initiates export |

Directional match explanations must never be described as eligibility, hiring
probability, interview probability, guaranteed fit, or guaranteed success.

### 3.3 Structured validation and safe operations

- Define one structured schema per task and validate every model response on
  the server before persistence or display. Reject unknown fields where the
  format permits it; re-check dates, URLs, enums, IDs, and length limits with
  deterministic code.
- Apply task-specific timeouts. Permit at most one same-model retry for a
  transient transport or schema failure and at most one upward escalation.
  Never create an unbounded retry or model loop.
- Fail safely with actionable states such as "Review manually" or "Try
  again." Preserve the user's source text and accepted edits. Never fill a
  failed field with generated facts.
- Route to the least expensive model that safely fits the task. Escalate only
  for documented quality or ambiguity conditions. Record credits only after a
  complete, validated generation succeeds.
- Log task category, resolved model, latency, token/usage metadata, validation
  result, retry/escalation count, and outcome. Do not log resume bodies, raw
  private JDs, prompts containing personal data, API keys, or model response
  bodies.

### 3.4 Resume parsing and JD extraction

Resume upload remains a future phase. If implemented, file text extraction is
deterministic (`unpdf` / `mammoth`) and Luna may create only a structured
draft. The user must edit and confirm imported profile evidence before it can
support tailoring. A scanned PDF with no usable text fails honestly; OCR is
out of scope.

JD text remains private to its owner. Luna extracts company, title, location,
work mode, term, deadline, named skills, responsibilities, and explicit
requirements into an editable structured draft. A single user-directed URL
fetch may be implemented later with paste fallback; bulk crawling is never
allowed. Raw text is never copied into `board_jobs`.

### 3.5 Resume tailoring and the evidence trust boundary

The Master Profile is the complete evidence pool, but only entries with
`confirmed = true` may support AI suggestions. Editing confirmed evidence
resets it to unconfirmed; the user must explicitly reconfirm it. AI-generated
text may never confirm itself.

Sol output is a set of suggestions, not a silent resume mutation. Each
suggestion includes before/after text, supporting evidence IDs, matched
requirements, claim status, and a concise explanation of why the evidence
supports the wording. It must support accept, reject, and edit.
Sol must never invent or infer unsupported work experience, projects,
employers, skills, tools, responsibilities, metrics, results, team sizes,
dates, awards, certifications, leadership, internships, or academic
achievements. Missing evidence stays missing.

### 3.6 Mechanical and semantic claim checks

Do not rely on a prompt alone:

1. Verify every source evidence ID exists, belongs to the user, and is
   confirmed.
2. Verify referenced skills, employers, dates, metrics, and named facts are
   present in the supporting evidence or were explicitly edited by the user.
3. Use Terra for first-pass unsupported-claim classification and Sol only for
   difficult semantic disputes or final accepted-content review.
4. Keep unresolved or unsupported claims visible and block readiness/export.
5. Never discard a questionable suggestion silently; return it as rejected or
   needs-review evidence so the user understands the outcome.

### 3.7 Retrieval and cost controls

Tailoring does not need a general RAG system for V1. The confirmed Master
Profile and one JD fit in the task context, and partial retrieval could hide
better evidence. Deterministic filtering may reduce context, but the source
pool and evidence IDs remain auditable. Embeddings are optional later for
candidate ranking or duplicate detection, not a prerequisite for tailoring.

Provider caching may be evaluated later behind the centralized gateway. No
provider-specific caching contract belongs in feature code, and no cost or
quality claim is accepted without measured production data.

---

## 4. API 설계 (Next.js Route Handlers)

| Method | Path | 동작 | 비고 |
|---|---|---|---|
| POST | `/api/resumes` | 파일 업로드 + 파싱 + master profile 생성 | multipart |
| PATCH | `/api/profile` | master profile 수동 편집 저장 | |
| POST | `/api/jobs` | 공고 텍스트 저장 + JD extraction | |
| DELETE | `/api/jobs/:id` | 공고 + 연결된 versions cascade 삭제 | |
| POST | `/api/tailor` | tailoring 실행 (스트리밍 응답) | usage 체크 선행 |
| POST | `/api/versions/:id/export` | PDF 생성 → Storage → signed URL | |
| DELETE | `/api/resumes/:id` | 원본 파일 + Storage 객체 삭제 | |
| DELETE | `/api/account` | 계정 + 전체 데이터 + Storage 삭제 | 확인 절차 필수 |

Tracker(applications) CRUD는 route handler 없이 Supabase client + RLS로 직접 — 서버 로직이 필요 없는 단순 CRUD라서.

**Free tier enforcement:** the tailoring endpoint checks the server-written
credit ledger before generation and records usage only after a complete,
validated AI result succeeds. A failed, timed-out, rejected, or invalid
generation must not consume a credit. Job-save limits are enforced before
insertion.

---

## 5. 파일 처리

| 작업 | 라이브러리 | 비고 |
|---|---|---|
| PDF → text | `unpdf` | serverless 친화 (pdf.js 기반, 네이티브 의존성 없음) |
| DOCX → text | `mammoth` | 구조 보존은 불필요, 텍스트만 |
| Resume → PDF export | `@react-pdf/renderer` | React 컴포넌트로 템플릿 정의, 서버 렌더 |

Export는 1개 템플릿(단정한 1-column ATS-safe)으로 시작. 템플릿 다양화는 유료 기능 후보. DOCX export는 V1 스코프 밖 (계획서에 있지만 PDF가 co-op 지원의 99%를 커버 — 필요해지면 `docx` 패키지 추가).

업로드 제한: 5MB, PDF/DOCX만, magic bytes 검증.

---

## 6. 프라이버시 & 컴플라이언스

BC 소재 사용자 대상이므로 **PIPEDA + BC PIPA** 기준. 계획서 원칙의 구현 매핑:

| 원칙 | 구현 |
|---|---|
| 개인정보 최소 수집 | 가입 시 email + 학교/전공/졸업년도만. 전화번호 등은 이력서 안에만 존재 |
| resume 원본/생성본 삭제 | §2 cascade + Storage 삭제 핸들러. 삭제는 soft delete 없이 즉시 hard delete |
| 데이터 판매 금지 | V1에 판매 경로 자체가 없음. privacy policy에 명시 |
| AI training separate opt-in | `profiles.ai_training_opt_in` defaults to `false`. No model-training use is planned without separate explicit consent; provider data-handling terms must be reviewed and accurately disclosed before AI launch |
| bias 리스크 | V1에는 ranking/score 기능 없음. `keyword_report`는 사용자 본인에게만 보이는 매칭 정보로 한정 |

추가 구현 사항:
- Storage 버킷은 전부 private, 접근은 signed URL(짧은 TTL)로만.
- Future AI requests may contain resume evidence and private JD text; keep
  request/response bodies out of logs and record metadata only.
- 계정 삭제 시 30일 유예 없이 즉시 삭제 (학생 대상 신뢰 포인트로 홍보 가능).

---

## 7. UI / 디자인

**단일 소스: [DESIGN.md](DESIGN.md)** — 디자인 토큰, 레이아웃(다크 사이드바 + 화이트 캔버스), 컴포넌트 규칙, 화면별 스펙, empty/loading/error state, AI trust 라벨("Supported by your resume", "Needs confirmation" 등)이 전부 정의돼 있음. UI 구현 시 이 문서를 그대로 따른다. 포지셔닝은 job board가 아니라 **productivity tool** (Linear/Notion/Asana 계열).

기술 스택 추가분 (DESIGN.md §19 반영):

| 용도 | 라이브러리 |
|---|---|
| 폼 | React Hook Form + Zod (AI 스키마와 Zod 공유) |
| 테이블 (Jobs 페이지) | TanStack Table |
| Kanban DnD | dnd-kit |
| 대시보드 차트 | Recharts |
| 아이콘 | Lucide |

**MVP 화면 (7개):** Landing → Onboarding(학교/전공/target role/co-op term/work eligibility/resume upload) → Dashboard → Job detail → Resume tailoring workspace(3-panel) → Application kanban → Application detail. Calendar/Insights/Documents는 사이드바에 자리만 두고 V2.

**UI 생성 프로세스 (한 번에 끝내지 않음):**
1. 정보구조 — screen list, user flows, navigation, data hierarchy
2. Wireframe — low-fidelity 레이아웃
3. Visual design — spacing/typography/components/states를 DESIGN.md 토큰으로
4. Implementation — shadcn/ui + Tailwind 구현
5. Critique — UX designer 관점 자기 비판 + 10개 개선

각 단계 산출물을 검토·수정한 뒤 다음 단계로. Onboarding에서 수집하는 필드(target role, co-op term, work eligibility, preferred cities)는 §2 `profiles` 테이블에 컬럼 추가 필요:

```sql
alter table profiles add column target_roles text[],
  add column coop_term text,            -- e.g. 'Fall 2026 (4mo)'
  add column work_authorization text,   -- domestic / intl (co-op permit) 등
  add column preferred_cities text[];
```

## 8. 프로젝트 구조

```
coopfinder/
├─ app/
│  ├─ (marketing)/          # 랜딩
│  ├─ (app)/
│  │  ├─ dashboard/         # kanban tracker
│  │  ├─ jobs/[id]/         # 공고 상세 + tailor 버튼
│  │  ├─ profile/           # master profile 편집
│  │  └─ versions/[id]/     # tailored resume 뷰/편집/export
│  └─ api/                  # §4의 route handlers
├─ lib/
│  ├─ ai/                   # planned centralized routing, schemas, validation
│  ├─ parsing/              # unpdf, mammoth 래퍼
│  ├─ pdf/                  # @react-pdf 템플릿
│  └─ supabase/             # client 팩토리 (server/browser)
├─ supabase/migrations/     # §2 스키마
└─ components/
```

---

## 9. 구현 순서 (V1 마일스톤)

1. **주 1:** Supabase 프로젝트 + 스키마 + RLS + Auth(email, Google) + Next.js 스캐폴딩
2. **주 2:** Resume upload → parsing → master profile 편집 UI
3. **주 3:** Job save + JD extraction + tracker kanban (드래그 = status 변경)
4. **주 4:** Tailoring 파이프라인 + 검증 + 결과 편집 UI
5. **주 5:** PDF export + free tier 제한 + 삭제 플로우 + privacy policy
6. **주 6:** 폴리싱, SFU CSSS 등 클럽 대상 베타

**V1에서 의도적으로 뺀 것** (계획서의 "하지 말 것" + 추가): URL scraping, cover letter(스키마만 자리 잡아둠 — `resume_versions`와 동일 패턴으로 V1.5에 추가 용이), DOCX export, OCR, 이메일 알림/deadline reminder, 결제(베타 기간엔 수동 제한만).

---

# Auth & Guest Model v2 (2026-07-09) — supersedes blanket-auth assumptions above

> Adopted with the product-led onboarding strategy in
> [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md). Where earlier sections of this
> document assume "all app routes behind login", **this section wins.**
> Written in English for coding agents. The existing initial migration
> (`supabase/migrations/202607090001_initial_mvp_schema.sql`) stays as-is;
> everything below is a **delta migration**.

## A. Route & auth model (hybrid)

| Route | Access | Notes |
|---|---|---|
| `/` | public | authed → redirect `/dashboard`; guest → redirect `/start` (until a landing page exists) |
| `/start` | public | guest onboarding; harmless for authed users (offer link to `/resumes/master`) |
| `/jobs`, `/jobs/[id]` | public | render guest variant (starter catalog) vs authed variant (user's saved jobs) from session |
| `/login` | public | accepts `?next=` and `?reason=` |
| `/dashboard`, `/applications(/**)`, `/resumes(/**)`, `/calendar`, `/insights`, `/documents`, `/settings` | auth required | enforced in `middleware.ts` |

Implementation rules:

- `middleware.ts` matcher covers **only the private prefixes**. Do not wrap
  the whole `(app)` group. Public pages read the session (if any) via the
  server Supabase client and branch guest/authed in the page component.
- Gated actions on public pages (save / full analysis / tailor) are **UI
  gates**, not route guards: the API/server-action behind them still requires
  a session and returns 401 for guests. Never rely on the UI gate alone.
- `/login?next=` must be validated as a same-origin relative path before
  redirecting after auth.

## B. Guest draft model (device-only)

- Storage: `localStorage["coopfinder.guest_draft.v1"]`. No server writes in
  guest mode. No name/email/files in the draft.

```ts
interface GuestDraftV1 {
  version: 1;
  updatedAt: string;              // ISO
  profile: {
    school?: "SFU" | "UBC" | "Waterloo" | "Other";
    program?: string;
    coopTerm?: string;            // e.g. "Fall 2026 (4mo)"
    workAuthorization?: string;   // same enum as profiles.work_authorization
    targetRoles?: string[];
    preferredLocations?: string[];
  };
  skills: string[];
  entries: Array<{
    id: string;                   // client uuid
    section: "experience" | "project" | "education" | "skills";
    title: string;
    text: string;
    skills: string[];
  }>;
}
```

- Guest matching is **client-side and deterministic** against `catalog_jobs`:
  score = weighted skill overlap (required 2x, nice-to-have 1x) + term
  compatibility + work-auth filter. No AI call paths are reachable while
  signed out. Copy rules: DESIGN.md §22.4.

## C. Guest → user migration

Server action `migrateGuestDraft(draft: GuestDraftV1)` invoked once after
first sign-in when a local draft exists:

1. Validate the draft against a zod schema (shared with the client).
2. If the user's `master_profile_entries` count is 0 and `profiles` row is
   empty/new → migrate automatically: upsert `profiles` fields, create
   `master_profiles` + `master_profile_entries`. Entries insert with
   `confirmed = true` (human-typed; `confirmed = false` is reserved for
   machine-extracted entries from future resume parsing).
3. If the account already has entries → do nothing server-side; the client
   shows the import prompt (DESIGN.md §22.6) and calls the action with an
   explicit `mode: "import"` on confirm.
4. Idempotency: the action stores `md5(draft json)` in
   `master_profiles.data->>'imported_draft_hash'`; a repeat call with the
   same hash is a no-op. Client clears localStorage only after a 2xx.

## D. Schema delta (new migration file)

```sql
-- 1) Curated starter catalog (public read, service-role write)
create table public.catalog_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company_name text not null,
  location text,
  work_mode text check (work_mode in ('Remote','Hybrid','On-site')),
  term text,
  deadline date,
  work_authorization text,
  summary text not null,            -- written in-house, never scraped text
  required_skills text[] not null default '{}',
  nice_to_have_skills text[] not null default '{}',
  keywords text[] not null default '{}',
  source_url text not null,         -- always link out to the original posting
  is_active boolean not null default true,
  last_checked_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_jobs enable row level security;

-- Guests AND users may read active entries; nobody but service role writes.
create policy "catalog_jobs select active"
on public.catalog_jobs for select
to anon, authenticated
using (is_active = true);

-- 2) Tailoring credit ledger (append-only, server-written)
create table public.tailoring_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (
    reason in ('signup_grant','tailor_use','purchase','admin_adjust')
  ),
  ref text,                         -- e.g. resume_version id for tailor_use
  created_at timestamptz not null default now()
);

create index tailoring_credit_ledger_user_idx
  on public.tailoring_credit_ledger(user_id);

alter table public.tailoring_credit_ledger enable row level security;

create policy "credit ledger select own"
on public.tailoring_credit_ledger for select
to authenticated
using (user_id = auth.uid());
-- No insert/update/delete policies: writes go through service role only.

-- 3) Signup grant: +2 credits when a profile row is first created
create or replace function public.grant_signup_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tailoring_credit_ledger (user_id, delta, reason)
  values (new.user_id, 2, 'signup_grant');
  return new;
end;
$$;

create trigger profiles_grant_signup_credits
after insert on public.profiles
for each row execute function public.grant_signup_credits();

-- 4) Balance helper (server-side reads; also safe for client display)
create or replace function public.tailoring_credit_balance(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::integer
  from public.tailoring_credit_ledger
  where user_id = uid;
$$;
```

Consumption rule (Phase 7): the tailoring server route checks
`tailoring_credit_balance(auth.uid()) >= 1` **before** calling the AI, and
inserts the `-1 tailor_use` row **after** a successful generation, in the
same transaction as persisting the tailoring result. Failed generations must
not burn credits. Balance can never go negative because the check + insert
happen server-side with the service client.

## E. usage_counters vs credits

- `usage_counters` = **abuse guardrails** (e.g. `job_save_count` soft cap
  ~100/term, not advertised). Not an entitlement system.
- `tailoring_credit_ledger` = **entitlements** (what the user may consume).
- Do not add credit logic to `usage_counters`; do not rate-limit via the
  ledger.

## F. RLS considerations (delta)

- `catalog_jobs` is the only table readable by `anon`. Everything else keeps
  `to authenticated` + `auth.uid()` ownership from the initial migration.
- The credit ledger is readable by owners, writable by no client role —
  grants and consumption go through `security definer` functions or the
  service-role client inside server routes.
- The signup-grant trigger is `security definer` because the inserting user
  has no insert policy on the ledger (by design).
- Companies policy note (unchanged): `created_by = auth.uid()` for writes;
  catalog jobs deliberately use a denormalized `company_name` instead of the
  `companies` table so the public surface joins nothing user-owned.

---

# Board, Intake & Export v3 (2026-07-09) — supersedes parts of v2

> Adopted with strategy revision 2 (PRODUCT_STRATEGY.md). Supersedes v2 on two
> points: `catalog_jobs` becomes **`board_jobs`** with a moderation lifecycle,
> and `/jobs` is **private again** (guests are redirected to `/board`, so v2's
> dual-mode guest `/jobs` is dropped). Everything else in v2 (guest draft,
> migration, credit ledger, hybrid middleware approach) still applies.

## A. Route model (v3)

| Route | Access | Notes |
|---|---|---|
| `/`, `/start`, `/board`, `/board/[id]`, `/login` | public | `/` redirects authed→`/dashboard`, guest→`/start` |
| `/jobs`, `/jobs/[id]` | auth | existing MVP screens unchanged; **proxy special-case: guest → redirect `/board`** (not `/login`) |
| `/dashboard`, `/applications/**`, `/resumes/**`, `/calendar`, `/insights`, `/documents`, `/settings` | auth | unchanged (already in `proxy.ts` matcher) |
| `/admin/board` | admin (`profiles.is_admin`) | later phase; MVP moderation happens in Supabase Studio |

`proxy.ts` changes: add `/jobs/:path*` to the matcher with a guest redirect
target of `/board` instead of `/login` (keep `/login?next=` for all other
private prefixes). Server actions/routes behind gated actions still enforce
auth independently — the proxy is UX, not security.

## B. Schema delta v3 (new migration; rename is safe pre-production)

```sql
-- 1) catalog_jobs -> board_jobs with moderation lifecycle
alter table public.catalog_jobs rename to board_jobs;

alter table public.board_jobs
  add column status text not null default 'approved' check (
    status in ('pending_review','approved','rejected','archived')
  ),
  add column submitted_by uuid references auth.users(id) on delete set null,
  add column submitted_url text,
  add column submission_note text,
  add column reviewed_at timestamptz,
  add column review_note text;

-- `expired` is derived, not stored: deadline < current_date. Persisting it
-- would need a cron; deriving it cannot go stale.

drop policy "catalog_jobs select active" on public.board_jobs;

create policy "board_jobs select public approved"
on public.board_jobs for select
to anon, authenticated
using (
  status = 'approved'
  and is_active = true
  and (deadline is null or deadline >= current_date)
);

create policy "board_jobs select own submissions"
on public.board_jobs for select
to authenticated
using (submitted_by = auth.uid());

-- Submissions are inserted via a security-definer function so users can
-- ONLY create pending rows with themselves as submitter; no direct insert
-- policy. Admin approval/summary-writing uses service role (Studio for MVP).
create or replace function public.submit_board_job(
  p_title text, p_company_name text, p_location text, p_term text,
  p_work_mode text, p_deadline date, p_source_url text, p_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.board_jobs
    (title, company_name, location, term, work_mode, deadline, source_url,
     summary, status, submitted_by, submitted_url, submission_note, is_active)
  values
    (p_title, p_company_name, p_location, p_term, p_work_mode, p_deadline,
     p_source_url, '', 'pending_review', auth.uid(), p_source_url, p_note, false)
  returning id into v_id;
  return v_id;
end; $$;
-- Note: summary starts empty and is_active=false; the reviewer writes the
-- in-house summary and sets status='approved', is_active=true. The user's
-- pasted/fetched text is NEVER copied into this table.

-- 2) Intake audit/telemetry
create table public.job_intake_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_type text not null check (input_type in ('url','text')),
  url text,
  outcome text not null check (
    outcome in ('extracted','fallback_manual','fetch_blocked','failed')
  ),
  overall_confidence numeric(3,2),
  model_tier text,
  job_posting_id uuid references public.job_postings(id) on delete set null,
  created_at timestamptz not null default now()
);
create index job_intake_events_user_idx on public.job_intake_events(user_id);
alter table public.job_intake_events enable row level security;
create policy "intake events select own"
on public.job_intake_events for select
to authenticated using (user_id = auth.uid());
-- server-written only (service role); no client insert policy.

-- 3) job_postings intake columns
alter table public.job_postings
  add column intake_source text not null default 'manual' check (
    intake_source in ('pasted_url','pasted_text','board_save','manual')
  ),
  add column extraction_confidence numeric(3,2),
  add column board_job_id uuid references public.board_jobs(id) on delete set null;

-- 4) Admin flag (moderation UI later; harmless now)
alter table public.profiles add column is_admin boolean not null default false;
```

## C. Board vs. saved-job status models (do not mix)

- `board_jobs.status`: `pending_review | approved | rejected | archived`
  (+ derived `expired`). Moderation lifecycle; controls public visibility only.
- `job_postings.status` / `applications.status`: the existing pipeline
  (`saved … rejected`). Unchanged. A board rejection never touches the
  submitter's private rows.

## D. Intake flow & source_url rules

1. User submits URL or text (authed; guests stash into the device draft —
   `GuestDraftV1` gains an optional `stashedJobs: Array<{url?: string,
   text?: string, addedAt: string}>`, processed via the existing migration
   action after signup).
2. URL path: **one** server-side fetch of exactly that URL (short timeout,
   no retries, no redirects beyond same-site, standard UA). Blocked/failed →
   `job_intake_events.outcome = 'fetch_blocked'` and the UI falls back to
   paste-text. Never crawl, never queue background refetches.
3. Raw fetched/pasted text goes to the owner's `job_postings.raw_text` only.
   It is never written to `board_jobs` and never shown publicly.
4. GPT-5.6 Luna extraction → editable review form → user confirms → row saved with
   `extraction_confidence`; event logged.

## E. Extraction confidence model

Extraction returns per-field values + confidences and an overall score 0–1
(structured output; schema in `lib/ai/schemas/`). Thresholds (constants in
one module, tune with `job_intake_events` data):

| Overall confidence | Behavior |
|---|---|
| ≥ 0.75 | Review form, normal state |
| 0.40 – 0.75 | Review form with low-confidence banner + per-field flags (< 0.6) |
| < 0.40 or required fields missing | Treat as failed extraction → paste-text fallback |

Required fields for a save: `title` + (`company` or user-entered). Everything
else may be empty ("Not found — add manually").

## F. Planned GPT-5.6 task routing

The canonical routing, escalation, validation, and trust policy is §3. The
planned centralized server module maps task categories to:

- `gpt-5.6-luna` for validated structured cleanup/extraction/classification;
- `gpt-5.6-terra` for requirement normalization, confirmed-evidence mapping,
  directional explanations, claim classification, and escalation judgment;
- `gpt-5.6-sol` for nuanced evidence-backed suggestions, supported rewriting,
  and final semantic claim review.

Feature code requests a task category, never a model ID. Planned environment
keys are `OPENAI_API_KEY`, `OPENAI_MODEL_LUNA`, `OPENAI_MODEL_TERRA`, and
`OPENAI_MODEL_SOL`; these are examples only and are not implemented or
required by the current application. Guest paths call no model. Future server
calls log non-content task/model metadata (for example
`job_intake_events.model_tier`) without storing private resume or JD bodies.

## G. Deterministic PDF export pipeline

AI may help produce content **before** review; the render path is AI-free.

1. Preconditions (server-enforced): resume version exists; readiness passed
   (all suggestions reviewed, no unsupported claims outstanding, claim check
   passed). Export endpoints re-check; the disabled button is not the gate.
2. Snapshot: canonicalize accepted content JSON (sorted keys) →
   `content_hash = sha256(canonical_json)`. The snapshot contains exactly the
   accepted/edited text — no regeneration, no cleanup pass, no new claims
   possible by construction.
3. Render: server-side `@react-pdf/renderer` with a **versioned template**
   (`template_version`, e.g. `ats-clean-1`). No AI call anywhere in this
   path. Same snapshot + same template version ⇒ same document content.
4. Record: store the PDF privately (Supabase Storage), and on
   `resume_versions`: `export_path`, `exported_at`, `template_version`,
   `content_hash`. Re-exports of an unchanged version reuse the snapshot.
5. Post-export UX returns the user to `source_url` (DESIGN.md §23.5) —
   applying happens on the original site, by the user.

---

# As-Built Backend Notes (synchronized 2026-07-13)

> Incremental documentation sync — records what is actually implemented.
> Where the v3 planning section above differs from the shipped SQL, **the
> migration files win.** The development database is connected and migrations
> through `202607130005` are applied; §K separates passed live checks from the
> remaining verification gap.

## H. Shipped migrations (chronological)

1. `202607090001_initial_mvp_schema.sql` — core user-owned tables + RLS.
2. `202607090002_product_led_onboarding_delta.sql` — `catalog_jobs`,
   `tailoring_credit_ledger`, signup grant.
3. `202607090003_board_intake_export_v3.sql` — renames `catalog_jobs` →
   `board_jobs`; moderation columns + `board_jobs select public approved` /
   `board_jobs select own submissions` policies; `submit_board_job()`
   (superseded, see below); `job_intake_events`; `job_postings` intake
   columns (`intake_source`, `extraction_confidence`, `board_job_id`);
   `profiles.is_admin`.
4. `202607120001_atomic_board_submission.sql` — revokes authenticated
   execution of `submit_board_job()` and adds
   **`submit_board_job_with_private_copy(...)`**: one transactional
   `SECURITY DEFINER` RPC (empty `search_path`, execute granted only to
   `authenticated`) that atomically creates the private `job_postings` row
   and the `pending_review` `board_jobs` candidate. Caller identity comes
   from `auth.uid()`; `status` is forced to `pending_review`; `is_active`
   forced false; review fields cannot be supplied; full JD text lands only in
   `job_postings.raw_text`; the private row links via `board_job_id`.
5. `202607130001_unique_private_board_saves.sql` — partial unique index
   `job_postings_user_board_job_unique_idx` preventing duplicate
   board-saves per user. Note: applying it fails intentionally if duplicate
   board saves already exist (cleanup before apply, no silent data loss).
6. `202607130002_master_profile_guest_import.sql` — Master Profile
   persistence + guest-draft import (below).
7. `202607130003_fix_import_guest_draft_coalesce.sql` — forward-only repair
   for invalid schema qualification of the `coalesce` SQL expression.
8. `202607130004_fix_import_guest_draft_nullif.sql` — forward-only repair for
   invalid schema qualification of the `nullif` SQL expression.
9. `202607130005_fix_import_guest_draft_hash_ambiguity.sql` — qualifies the
   ledger hash predicate to resolve `draft_hash` output-column ambiguity.

## I. Master Profile persistence (as built)

- RPC **`save_master_profile(p_profile jsonb, p_skills jsonb, p_entries jsonb)`**
  — `SECURITY DEFINER`, `search_path = ''`, execute revoked from `PUBLIC` and
  `anon`, granted to `authenticated`; ownership from `auth.uid()` only.
- One transaction: upserts `profiles` scalars (school/program/grad year/term/
  work auth/locations/roles), upserts `master_profiles` with skills stored at
  `data.skills`, then **delete-and-reinsert** of `master_profile_entries`
  with `sort_order` = submitted order. Server re-validates everything
  (enum checks, length caps, ≤60 skills, ≤100 entries) — client payloads are
  not trusted.
- Client: `/resumes/master` (`page.tsx` + `master-profile-client.tsx` +
  `actions.ts`, types/queries/validation under `lib/master-profile/`).
  Reads go through `getMasterProfile()` (direct RLS-scoped selects on
  `profiles`, `master_profiles`, `master_profile_entries`).
- Supabase-unconfigured builds render an honest disabled state; **no mock
  profile is initialized in production paths**. No AI call anywhere in this
  flow. Evidence editing clears `confirmed`; reconfirmation is explicit
  (client behavior; future AI must treat `confirmed` as the trust boundary).

## J. Guest-draft import (as built)

- Client detection: `components/app/guest-draft-import-handoff.tsx`, mounted
  in `app/(app)/layout.tsx` for authenticated users. Reads
  `localStorage["coopfinder.guest_draft.v1"]` via `lib/guest-draft/storage.ts`
  and normalizes with `normalizeGuestDraft()` /
  `canonicalizeGuestDraft()` (`lib/guest-draft/normalize.ts`). Malformed JSON
  or invalid URLs → no server call, draft left in place, warning notice shown.
- Server: RPC **`import_guest_draft(p_draft jsonb, p_mode text)`** — same
  security posture as `save_master_profile` (definer, empty `search_path`,
  authenticated-only execute, `auth.uid()` ownership). The server re-validates
  the entire draft (limits: ≤60 skills, ≤40 entries, ≤20 stashed jobs; URL
  regex; enum checks) — browser-supplied IDs/hashes are never trusted.
- **Idempotency & atomicity:** the server computes a canonical SHA-256 draft
  hash (`extensions.digest`), takes
  `pg_advisory_xact_lock(hashtextextended(user_id))` to serialize concurrent
  imports, and records success in the **`guest_draft_imports`** ledger with
  `unique (user_id, draft_hash)` and `imported_counts`. A repeat call returns
  `already_imported`. All writes (profile, skills, entries, jobs, ledger)
  happen in one transaction — failure rolls back everything.
- **Modes:** `auto` imports only into a genuinely empty account (server-side
  emptiness check across profiles/master profile/entries/jobs); if data
  exists it returns `needs_confirmation` and the client shows the explicit
  merge prompt, which retries with `merge`.
- **Merge semantics (non-destructive):** populated scalar fields preserved;
  empty ones filled; `target_roles`/`preferred_locations`/skills unioned
  case-insensitively; duplicate entries skipped (section + title + normalized
  text); duplicate jobs skipped (same `source_url` or normalized `raw_text`).
  Nothing is deleted or overwritten.
- **Entries:** guest-authored evidence imports as `confirmed = true` (the
  user typed it); appended after existing entries (`max(sort_order)+1`).
- **Stashed jobs:** URL jobs keep `source_url` (`intake_source='pasted_url'`),
  text jobs keep `raw_text` (`intake_source='pasted_text'`). **No fetch, no
  scraping, no AI parsing, no invented metadata.** Because
  `job_postings.title` is `not null`, imports use the explicit review
  placeholder title **`Imported job - add title`** plus a review note —
  an honest schema-required placeholder, not extracted information.
- **Ledger RLS:** users can `select` only their own `guest_draft_imports`
  rows; there is no client write policy (writes happen inside the RPC).
- **localStorage clearing protocol:** the client removes
  `coopfinder.guest_draft.v1` only when the action result is complete,
  matches the normalized draft (`draft_hash` present and `updatedAt` match),
  and the status is `imported` or `already_imported`. On validation failure,
  invalid URL, Supabase unavailability, RPC failure, rollback, or a
  non-matching response, the draft remains on the device.

## K. Live verification status and remaining gap

Verified against the connected development Supabase project:

- migrations through `202607130005` applied and their expected schema objects
  were present;
- two-user RLS isolation for private `job_postings` passed;
- core authenticated behavior of
  `submit_board_job_with_private_copy()` passed;
- `import_guest_draft()` passed one authenticated import smoke after the
  three forward-only repairs;
- exact sequential repeat returned `already_imported` without duplicate
  state, and canonical JSON object-key-order normalization returned the same
  non-printed hash.

These checks do **not** verify all database behavior. Still unverified live:
guest-import concurrency/advisory-lock behavior, injected-failure transaction
rollback, existing-account merge behavior, broad cross-user isolation for
profile/evidence/ledger tables, real-session route protection, duplicate
board-save behavior, and a complete direct inspection of private raw-JD
boundaries. Keep these as an explicit release gate; do not infer them from the
passing checks above.
