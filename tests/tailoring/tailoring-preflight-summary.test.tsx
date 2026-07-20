import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TailoringPreflightSummary } from "../../components/app/tailor/tailoring-preflight-summary";
import type { OwnedTailoringPreflightResult } from "../../lib/tailoring/get-owned-tailoring-preflight";
import {
  TAILORING_PREFLIGHT_CONTRACT_VERSION,
  TAILORING_SAFETY_PROHIBITIONS,
  type TailoringPreflightPackage,
} from "../../lib/tailoring/tailoring-preflight";

const JOB_ID = "6892c5a6-387e-418a-b2c0-7f3561a65889";

function preflight(
  overrides: Partial<TailoringPreflightPackage> = {},
): TailoringPreflightPackage {
  return {
    contractVersion: TAILORING_PREFLIGHT_CONTRACT_VERSION,
    readiness: "ready",
    job: {
      id: JOB_ID,
      title: "Developer",
      companyName: "Example",
      location: "Vancouver",
    },
    matched: {
      requiredSkills: [
        { requirement: "TypeScript", matchedCandidateTerm: "TypeScript" },
      ],
      preferredSkills: [],
      requiredTechnologies: [
        { requirement: "React", matchedCandidateTerm: "React" },
      ],
      preferredTechnologies: [],
      softSkills: [
        { requirement: "Communication", matchedCandidateTerm: "Communication" },
      ],
      certifications: [],
      languages: [{ requirement: "French", matchedCandidateTerm: "French" }],
      keywords: [{ requirement: "Git", matchedCandidateTerm: "Git" }],
    },
    workAuthorization: {
      status: "exact_match",
      jobRequirements: ["Canadian work authorization"],
      candidateValue: "Canadian work authorization",
      matchedRequirement: "Canadian work authorization",
    },
    supportingEvidence: [
      {
        sourceType: "top_level_general_skill",
        displayTitle: "General skills",
        matchedTerms: ["TypeScript", "Git"],
      },
      {
        sourceType: "explicit_language",
        displayTitle: "Languages",
        matchedTerms: ["French"],
        languageProficiency: "fluent",
      },
    ],
    jobContext: { responsibilities: ["PRIVATE_JOB_RESPONSIBILITY"] },
    notEvidenced: [
      { category: "certification", requirement: "AWS Certification" },
    ],
    unassessed: {
      total: 2,
      categories: [
        { category: "education", count: 1 },
        { category: "experience", count: 1 },
      ],
    },
    safetyProhibitions: TAILORING_SAFETY_PROHIBITIONS,
    ...overrides,
  };
}

function render(result: OwnedTailoringPreflightResult) {
  return renderToStaticMarkup(<TailoringPreflightSummary result={result} />);
}

test("renders verified evidence, narrow sources, and separate work authorization", () => {
  const html = render({ status: "ready", preflight: preflight() });

  assert.match(html, />Evidence that can be emphasized</);
  assert.match(html, />Verified in your Master Profile/);
  assert.match(html, />Required skills</);
  assert.match(html, />Required technologies</);
  assert.match(html, />Soft skills</);
  assert.match(html, />Languages</);
  assert.match(html, />Keywords</);
  assert.match(html, /TypeScript/);
  assert.match(html, /React/);
  assert.match(html, /Communication/);
  assert.match(html, /French/);
  assert.match(html, /Git/);
  assert.match(html, />Supporting evidence</);
  assert.match(html, /General skills/);
  assert.match(html, /fluent/);
  assert.match(html, />Work authorization</);
  assert.match(html, />Exact match found</);
});

test("uses neutral limitation wording and keeps unassessed details compact", () => {
  const html = render({ status: "ready", preflight: preflight() });

  assert.match(html, />Not evidenced in your Master Profile</);
  assert.match(
    html,
    /These requirements will not be added as candidate claims\./,
  );
  assert.match(html, /Update your Master Profile if you have one of these qualifications/);
  assert.match(html, /AWS Certification/);
  assert.match(html, />Unassessed requirements</);
  assert.match(html, /Education \(1\)/);
  assert.match(html, /Experience \(1\)/);
  assert.doesNotMatch(html, /PRIVATE_JOB_RESPONSIBILITY/);
  assert.doesNotMatch(html, /you lack|you failed|unqualified/i);
});

test("renders safety, edit link, and the approved-evidence generation boundary", () => {
  const html = render({ status: "ready", preflight: preflight() });

  assert.match(
    html,
    /Tailoring will not invent qualifications that are not supported by your Master Profile/,
  );
  assert.match(html, /href="\/resumes\/master"/);
  assert.match(html, />Update Master Profile</);
  assert.match(html, /Generation uses only approved Master Profile bullets/);
  assert.doesNotMatch(html, /overall score|match score|Generate resume|Tailor now|Spend credit/i);
  assert.doesNotMatch(html, /\$|credit cost|1 credit/i);
});

test("renders insufficient and safe error states without internal details", () => {
  const insufficientJob = render({
    status: "insufficient_job_data",
    preflight: preflight({ readiness: "insufficient_job_data" }),
  });
  assert.match(insufficientJob, /Comparable job information is limited/);

  const insufficientCandidate = render({
    status: "insufficient_candidate_data",
    preflight: preflight({ readiness: "insufficient_candidate_data" }),
  });
  assert.match(insufficientCandidate, /More Master Profile evidence is needed/);
  assert.match(insufficientCandidate, /href="\/resumes\/master"/);

  assert.match(
    render({ status: "extraction_unavailable" }),
    /Complete job analysis/,
  );
  assert.match(
    render({ status: "invalid_extraction" }),
    /unavailable for this saved analysis/,
  );
  assert.match(
    render({ status: "unavailable" }),
    /temporarily unavailable/,
  );
  assert.equal(render({ status: "unauthenticated" }), "");
  assert.equal(render({ status: "not_found" }), "");
});

test("presentation uses semantic headings, lists, and mobile-first responsive grids", () => {
  const html = render({ status: "ready", preflight: preflight() });

  assert.match(html, /<h[23][^>]*>/);
  assert.match(html, /<ul/);
  assert.match(html, /grid gap-4 md:grid-cols-2/);
  assert.match(html, /grid gap-5 lg:grid-cols-2/);
});

test("route strictly separates recognized mock IDs, persisted UUIDs, and malformed IDs", () => {
  const route = readFileSync(
    "app/(app)/resumes/tailor/[jobId]/page.tsx",
    "utf8",
  );
  const jobDetail = readFileSync("app/(app)/jobs/[id]/page.tsx", "utf8");
  const publicJob = readFileSync("app/(app)/board/[id]/page.tsx", "utf8");

  assert.match(route, /mockJobs\.find\(\(item\) => item\.id === jobId\)/);
  assert.match(route, /if \(!isUuid\(jobId\)\) notFound\(\)/);
  assert.match(route, /getOwnedTailoringPreflight\(jobId\)/);
  assert.match(route, /<TailoringPreflightSummary result=\{result\}/);
  assert.match(route, /<TailoringWorkspace/);
  assert.match(route, /mockTailoringSessions\[job\.id\]/);
  assert.match(route, /if \(result\.status === "not_found"\) notFound\(\)/);
  assert.match(jobDetail, /href=\{`\/resumes\/tailor\/\$\{job\.id\}`\}/);
  assert.match(jobDetail, />\s*Review tailoring preflight\s*</);
  assert.doesNotMatch(publicJob, /Review tailoring preflight|\/resumes\/tailor\//);
});

test("the read-only preflight components contain no provider, credit, or persistence operation", () => {
  const files = [
    "lib/tailoring/tailoring-preflight.ts",
    "lib/tailoring/get-owned-tailoring-preflight.ts",
    "components/app/tailor/tailoring-preflight-summary.tsx",
  ];
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");

  assert.doesNotMatch(source, /responses\.create|chat\.completions|OpenAI|invokeProvider/);
  assert.doesNotMatch(
    source,
    /tailoring_credit_balance|tailoring_credit_ledger|reserve.*credit|consume.*credit|refund.*credit/i,
  );
  assert.doesNotMatch(
    source,
    /from\("resume_versions"\)|insert\(|update\(|upsert\(|persist/i,
  );
});
