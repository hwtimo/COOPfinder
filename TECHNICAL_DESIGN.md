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
     │  Supabase          │   │  Claude API          │
     │  ├─ Postgres (RLS) │   │  ├─ resume parsing   │
     │  ├─ Auth           │   │  ├─ JD extraction    │
     │  └─ Storage        │   │  └─ tailoring        │
     └────────────────────┘   └─────────────────────┘
```

**원칙:**
- AI 호출과 파일 파싱은 전부 서버 사이드 (API key 노출 방지, 사용량 제한 강제).
- DB 접근은 Supabase RLS로 사용자별 격리 — 서버 코드 버그가 있어도 다른 유저 데이터가 안 새는 마지막 방어선.
- V1에는 별도 queue worker 불필요. tailoring은 스트리밍으로 동기 처리 (30초~2분). 나중에 batch 기능이 필요해지면 그때 Supabase Edge Functions + pg_cron 또는 QStash 추가.

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

## 3. AI 파이프라인

SDK: `@anthropic-ai/sdk` (TypeScript). 모든 호출은 route handler / server action 안에서.

### 3.1 모델 선택 & 비용

기본 모델은 **Claude Sonnet 5 (`claude-sonnet-5`)** — $3 input / $15 output per 1M tokens (2026-08-31까지 intro 가격 $2/$10). 단순 추출인 JD extraction은 **Haiku 4.5 (`claude-haiku-4-5`)** — $1/$5.

품질은 모델보다 **기준틀이 담당한다**: structured outputs로 스키마를 강제하고(§3.2), 출처 ID 참조를 요구하고(§3.5), 서버 코드에서 기계 검증(§3.6)하는 구조라서 모델이 벗어날 공간 자체가 좁다. 이 파이프라인에서 Sonnet 5는 충분하고, 검증 실패율이 실제로 높게 나오는 경우에만 tailoring 경로를 상위 모델로 올리는 것을 재검토.

| 작업 | 모델 | 예상 토큰 (in/out) | 비용/건 (정가) |
|---|---|---|---|
| Resume parsing (1회성) | Sonnet 5 | ~5K / ~2K | ~$0.045 |
| JD extraction | Haiku 4.5 | ~2K / ~1K | ~$0.007 |
| Resume tailoring | Sonnet 5 | ~8K / ~3K | ~$0.069 |

무료 유저(월 3회 tailor + job save 20개) 원가 ≈ **$0.3/월/유저** 미만, prompt caching(§3.7) 적용 시 더 내려감. 유료(CAD $6–12/월)는 무제한 tailoring이어도 마진이 넉넉한 구조.

Sonnet 5 주의점: adaptive thinking이 기본 on이고 (`thinking` 필드 생략 시), sampling 파라미터(`temperature` 등)는 넣으면 400. 추출 작업은 `output_config: {effort: "low"}`, tailoring은 기본값(`high`)으로.

### 3.2 공통 패턴: Structured Outputs

세 작업 모두 JSON 스키마가 고정이므로 **structured outputs**를 쓴다. Zod 스키마 하나로 타입과 검증을 통일:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic(); // 서버 전용

const response = await client.messages.parse({
  model: "claude-sonnet-5",
  max_tokens: 16000,
  system: [PARSING_SYSTEM_PROMPT_BLOCK],       // §3.6 캐싱 참고
  messages: [{ role: "user", content: resumeText }],
  output_config: { format: zodOutputFormat(MasterProfileSchema) },
});
const profile = response.parsed_output; // 검증된 MasterProfile
```

주의: structured outputs 스키마에는 recursive 스키마, min/max 제약이 안 들어가고 모든 object에 `additionalProperties: false`가 필요 — Zod 헬퍼가 처리해 줌.

### 3.3 Resume parsing → Master Profile

1. 업로드 파일을 Storage에 저장.
2. 텍스트 추출: PDF는 `unpdf`, DOCX는 `mammoth` (§5).
3. 추출 텍스트를 Claude에 넘겨 `MasterProfileSchema`로 structured extraction.
4. 결과를 편집 가능한 폼으로 보여주고, 사용자가 **경험/기술을 추가 입력**할 수 있게 함 — "이력서에 안 넣었던 것까지 전부 적으세요"가 온보딩 카피. pool이 클수록 tailoring이 좋아진다.
5. 저장 시 각 experience에 `id` 부여.

PDF가 스캔본(텍스트 추출 실패)이면 V1에서는 "텍스트 기반 PDF를 올려주세요" 에러로 처리. OCR은 스코프 밖.

### 3.4 JD extraction

URL 붙여넣기: V1에서는 **URL fetch를 서버에서 하지 않는다** (scraping 리스크 + 로그인 벽 뒤 공고 다수). 사용자가 공고 텍스트를 붙여넣는 것을 기본 UX로, URL은 메타데이터로만 저장. 이게 계획서의 "Phase 1: user-fed data" 원칙과도 일치.

```typescript
const JobExtractionSchema = z.object({
  title: z.string(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  work_term: z.string().nullable(),        // e.g. "Fall 2026, 8 months"
  deadline: z.string().nullable(),         // ISO date if present
  summary: z.string(),                     // 3-4문장 요약
  required_skills: z.array(z.string()),
  nice_to_have_skills: z.array(z.string()),
  keywords: z.array(z.string()),           // ATS 키워드 후보
  responsibilities: z.array(z.string()),
});
```

### 3.5 Resume tailoring (핵심 기능)

입력: master profile 전체 + JD extraction. 출력: 이 공고에 맞게 **선별·재작성된** 이력서 구조.

```typescript
const TailoredResumeSchema = z.object({
  selected_experience_ids: z.array(z.string()),  // master profile에서 고른 것
  sections: z.array(z.object({
    heading: z.string(),                          // e.g. "Relevant Projects"
    entries: z.array(z.object({
      source_experience_id: z.string(),           // ← 출처 필수
      title: z.string(),
      organization: z.string().nullable(),
      dates: z.string().nullable(),
      bullets: z.array(z.object({
        text: z.string(),
        source_bullet_index: z.number().nullable(), // 원본 bullet 참조
        matched_keywords: z.array(z.string()),
      })),
    })),
  })),
  skills_section: z.object({ /* JD 관련 기술 우선 정렬 */ }),
  keyword_report: z.object({
    matched: z.array(z.string()),
    missing: z.array(z.string()),        // profile에 없어서 못 넣은 키워드
  }),
});
```

시스템 프롬프트 핵심 규칙:
- master profile에 **있는 사실만** 사용. 새 경험·수치·기술을 만들어내지 말 것.
- bullet 재작성은 표현/강조/키워드 정렬만 — 의미를 바꾸지 말 것.
- JD 키워드가 profile에 없으면 지어내지 말고 `keyword_report.missing`에 넣을 것.

응답은 2~3K 토큰이라 **스트리밍**으로 내려서 UI에 진행감을 준다 (`client.messages.stream()` → `finalMessage()`).

### 3.6 Anti-hallucination 검증 (코드 레벨)

프롬프트만 믿지 않는다. 응답 수신 후 서버에서 기계적으로 검증:

1. 모든 `source_experience_id`가 master profile에 실재하는지 확인 — 없으면 해당 entry 폐기.
2. `matched` 키워드가 실제로 profile 텍스트에 등장하는지 substring/normalize 체크.
3. 검증 실패율이 높으면 해당 응답 자체를 재시도 (1회).

UI에서는 각 bullet에 "원본 보기" 토글을 붙여 사용자가 diff를 확인하고 수정할 수 있게 함 — 최종 책임은 사용자에게 있고, 사용자가 검수했다는 UX가 신뢰의 근간.

### 3.7 RAG / embeddings은 어디에 쓰나

**Tailoring에는 RAG가 필요 없다.** RAG는 컨텍스트에 다 안 들어가는 큰 코퍼스에서 관련 조각을 검색해 넣는 기법인데, 여기서 모델이 봐야 할 것은 master profile 전체(수천 토큰)와 JD 하나 — 통째로 프롬프트에 들어가고도 남는다. 오히려 retrieval로 profile 일부만 넣으면 "전체 pool에서 가장 어울리는 경험을 고른다"는 핵심 가치가 깨진다. 품질을 만드는 기준틀은 RAG가 아니라 **structured outputs + 출처 ID 강제 + 서버 검증**(이미 설계에 포함)이다.

**Embeddings가 실제로 유용해지는 지점은 V2:**
- **Match score / recommended jobs** — profile embedding ↔ JD embedding 유사도로 후보를 빠르고 싸게 랭킹 (LLM 호출 없이). Supabase `pgvector`로 바로 구현 가능.
- **저장 공고 dedup** — 같은 공고를 두 번 저장하는 것 감지.
- V1에서는 match/missing keywords가 tailoring 응답의 `keyword_report`로 이미 나오므로 별도 인프라 불필요. 스키마에 `job_postings.embedding vector` 컬럼만 자리 잡아두면 마이그레이션 없이 V2 확장 가능.

### 3.8 Prompt caching

시스템 프롬프트(tailoring 규칙, 수백~수천 토큰)는 고정이므로 `cache_control` 캐싱:

```typescript
system: [{
  type: "text",
  text: TAILORING_SYSTEM_PROMPT,   // 동적 값 절대 삽입 금지 (날짜, user id 등)
  cache_control: { type: "ephemeral" },
}],
```

주의: Sonnet 5의 최소 캐시 prefix는 **2048 토큰**이라, 시스템 프롬프트가 그보다 짧으면 조용히 캐시가 안 된다. 같은 유저가 연달아 여러 공고를 tailor하는 패턴(핵심 사용 패턴!)에서는 master profile을 시스템 프롬프트 뒤 첫 user 블록에 넣고 그 블록에 breakpoint를 찍으면 profile까지 캐시돼서 2번째 tailor부터 input 비용이 ~90% 절감된다. `usage.cache_read_input_tokens`로 히트 확인.

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

**Free tier 강제:** `/api/tailor` 진입 시 `usage_counters`를 service role로 조회/증가 (atomic `insert ... on conflict do update`). 월 3회 초과 시 402 + 업그레이드 안내. job 저장 20개 제한은 insert 전 count 체크. 카운터 증가는 Claude 호출 **성공 후**에 커밋 (실패한 호출로 횟수 차감 방지).

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
| AI 학습 별도 opt-in | `profiles.ai_training_opt_in` 기본 `false`. V1에서는 자체 학습이 없으므로 사실상 미래 대비 플래그. Claude API는 기본적으로 고객 데이터를 학습에 쓰지 않음 — privacy policy에 "AI 처리에 Anthropic API 사용, 학습 미사용" 명시 |
| bias 리스크 | V1에는 ranking/score 기능 없음. `keyword_report`는 사용자 본인에게만 보이는 매칭 정보로 한정 |

추가 구현 사항:
- Storage 버킷은 전부 private, 접근은 signed URL(짧은 TTL)로만.
- Claude API로 보내는 데이터는 이력서 텍스트 + JD — 로그에 본문 남기지 않기 (요청 메타데이터만 로깅).
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
│  ├─ ai/                   # Claude 호출, 프롬프트, Zod 스키마, 검증
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
