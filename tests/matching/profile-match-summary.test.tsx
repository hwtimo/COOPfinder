import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ProfileMatchSummary } from "../../components/jobs/profile-match-summary";
import type { OwnedJobMatchResult } from "../../lib/matching/get-owned-job-match";
import {
  RESUME_JOB_EXACT_MATCH_VERSION,
  type RequirementCoverageGroup,
  type ResumeJobExactMatchResult,
} from "../../lib/matching/resume-job-match";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";

function group(
  overrides: Partial<RequirementCoverageGroup> = {},
): RequirementCoverageGroup {
  return {
    totalUniqueRequirements: 2,
    matchedCount: 1,
    coveragePercentage: 50,
    matchedItems: [
      {
        category: "required_skill",
        requirement: "TypeScript",
        matchedCandidateTerm: "typescript",
      },
    ],
    notEvidencedItems: [
      { category: "required_technology", requirement: "PostgreSQL" },
    ],
    ...overrides,
  };
}

function match(
  overrides: Partial<ResumeJobExactMatchResult> = {},
): ResumeJobExactMatchResult {
  return {
    contractVersion: RESUME_JOB_EXACT_MATCH_VERSION,
    status: "comparable",
    required: group(),
    preferred: group({
      matchedItems: [
        {
          category: "preferred_skill",
          requirement: "Communication",
          matchedCandidateTerm: "Communication",
        },
      ],
      notEvidencedItems: [
        { category: "preferred_technology", requirement: "Docker" },
      ],
    }),
    keywords: group({
      totalUniqueRequirements: 1,
      matchedCount: 1,
      coveragePercentage: 100,
      matchedItems: [
        {
          category: "keyword",
          requirement: "Git",
          matchedCandidateTerm: "Git",
        },
      ],
      notEvidencedItems: [],
    }),
    softSkills: group({
      matchedItems: [
        {
          category: "soft_skill",
          requirement: "Communication",
          matchedCandidateTerm: "Communication",
        },
      ],
      notEvidencedItems: [
        { category: "soft_skill", requirement: "Leadership" },
      ],
    }),
    certifications: group({
      totalUniqueRequirements: 1,
      matchedCount: 1,
      coveragePercentage: 100,
      matchedItems: [
        {
          category: "certification",
          requirement: "AWS Certified Developer",
          matchedCandidateTerm: "AWS Certified Developer",
        },
      ],
      notEvidencedItems: [],
    }),
    languages: group({
      totalUniqueRequirements: 1,
      matchedCount: 0,
      coveragePercentage: 0,
      matchedItems: [],
      notEvidencedItems: [{ category: "language", requirement: "French" }],
    }),
    workAuthorization: {
      status: "exact_match",
      jobRequirements: ["Eligible to work in Canada"],
      candidateValue: "Eligible to work in Canada",
      matchedRequirement: "Eligible to work in Canada",
    },
    dataCompleteness: {
      uniqueCandidateTerms: 3,
      comparableJobTerms: 9,
      unassessedJobRequirements: 2,
    },
    unassessedRequirements: [
      { category: "education", requirement: "PRIVATE_EDUCATION_TEXT" },
      {
        category: "responsibility",
        requirement: "PRIVATE_RESPONSIBILITY_TEXT",
      },
    ],
    ...overrides,
  };
}

function matchedResult(
  overrides: Partial<ResumeJobExactMatchResult> = {},
): OwnedJobMatchResult {
  return { status: "matched", jobId: JOB_ID, match: match(overrides) };
}

function render(result: OwnedJobMatchResult) {
  return renderToStaticMarkup(<ProfileMatchSummary result={result} />);
}

test("comparable result renders required, preferred, and keyword groups", () => {
  const html = render(matchedResult());

  assert.match(html, />Required requirements</);
  assert.match(html, />Preferred requirements</);
  assert.match(html, />Keywords</);
  assert.match(html, /1 of 2 found · 50% coverage/);
});

test("renders soft-skill, certification, and language coverage groups", () => {
  const html = render(matchedResult());

  assert.match(html, /id="profile-match-soft-skills"/);
  assert.match(html, />Soft skills</);
  assert.match(html, /id="profile-match-certifications"/);
  assert.match(html, />Certifications</);
  assert.match(html, /id="profile-match-languages"/);
  assert.match(html, />Languages</);
  assert.match(html, /AWS Certified Developer/);
  assert.match(html, />French</);
});

test("empty additive groups show no-comparable messaging and null coverage safely", () => {
  const empty = group({
    totalUniqueRequirements: 0,
    matchedCount: 0,
    coveragePercentage: null,
    matchedItems: [],
    notEvidencedItems: [],
  });
  const html = render(
    matchedResult({ softSkills: empty, certifications: empty, languages: empty }),
  );

  assert.equal(
    (html.match(/No comparable requirements extracted/g) ?? []).length >= 3,
    true,
  );
  assert.doesNotMatch(html, /0 of 0 found Â·/);
});

test("new evidence groups retain neutral wording without proficiency verdicts", () => {
  const html = render(matchedResult());

  assert.match(html, /Not evidenced in your Master Profile/);
  assert.doesNotMatch(html, /lacks|unqualified|proficiency pass|proficiency fail/i);
});

test("uses accurate matched and not-evidenced wording", () => {
  const html = render(matchedResult());

  assert.match(html, /Found in your Master Profile/);
  assert.match(html, /Not evidenced in your Master Profile/);
  assert.doesNotMatch(html, /You lack|unqualified|Failed requirement/i);
});

test("does not render an overall score or qualification label", () => {
  const html = render(matchedResult());

  assert.doesNotMatch(html, /overall score|match score|qualified|ranking/i);
});

test("null coverage renders no misleading percentage", () => {
  const html = render(
    matchedResult({
      required: group({
        totalUniqueRequirements: 0,
        matchedCount: 0,
        coveragePercentage: null,
        matchedItems: [],
        notEvidencedItems: [],
      }),
    }),
  );

  assert.match(html, /0 of 0 found/);
  assert.match(html, /No comparable requirements extracted/);
  assert.doesNotMatch(html, /0 of 0 found ·/);
});

test("renders exact work-authorization match separately", () => {
  const html = render(matchedResult());

  assert.match(html, />Work authorization</);
  assert.match(html, /Exact match found/);
});

test("renders work-authorization mismatch without an eligibility verdict", () => {
  const html = render(
    matchedResult({
      workAuthorization: {
        status: "mismatch",
        jobRequirements: ["Citizen"],
        candidateValue: "Open work permit",
      },
    }),
  );

  assert.match(html, /No exact match found/);
  assert.match(html, /does not determine eligibility/);
});

test("renders missing candidate work authorization with a profile link", () => {
  const html = render(
    matchedResult({
      workAuthorization: {
        status: "no_candidate_value",
        jobRequirements: ["Eligible to work in Canada"],
        candidateValue: null,
      },
    }),
  );

  assert.match(html, /No Master Profile value/);
  assert.match(html, /href="\/resumes\/master"/);
});

test("summarizes unassessed requirements without dumping their text", () => {
  const html = render(matchedResult());

  assert.match(html, /2 analyzed job requirements could not be compared/);
  assert.match(html, /Education \(1\), Responsibilities \(1\)/);
  assert.doesNotMatch(html, /PRIVATE_EDUCATION_TEXT/);
  assert.doesNotMatch(html, /PRIVATE_RESPONSIBILITY_TEXT/);
});

test("renders insufficient job data safely", () => {
  const html = render(matchedResult({ status: "insufficient_job_data" }));

  assert.match(html, /No comparable job requirements/);
  assert.match(html, /does not yet contain comparable structured terms/);
});

test("renders insufficient candidate data with the Master Profile link", () => {
  const html = render(
    matchedResult({ status: "insufficient_candidate_data" }),
  );

  assert.match(html, /More Master Profile data needed/);
  assert.match(html, /href="\/resumes\/master"/);
});

test("renders extraction unavailable guidance without duplicating Analyze", () => {
  const html = render({ status: "extraction_unavailable" });

  assert.match(html, /Complete job analysis before profile matching/);
  assert.doesNotMatch(html, /<button|>Analyze</);
});

test("renders profile unavailable guidance with the Master Profile link", () => {
  const html = render({ status: "profile_unavailable" });

  assert.match(html, /Add explicit skills to your Master Profile/);
  assert.match(html, /href="\/resumes\/master"/);
});

test("renders invalid extraction as a generic unavailable state", () => {
  const html = render({ status: "invalid_extraction" });

  assert.match(html, /Profile matching is unavailable/);
  assert.doesNotMatch(html, /schema|parser|JSON|SQL/i);
});

test("renders unexpected failures as a generic temporary state", () => {
  const html = render({ status: "unavailable" });

  assert.match(html, /temporarily unavailable/);
  assert.doesNotMatch(html, /stack|exception|SQL/i);
});

test("not-found and unauthenticated states render no ownership details", () => {
  assert.equal(render({ status: "not_found" }), "");
  assert.equal(render({ status: "unauthenticated" }), "");
});

test("ignores raw extraction, profile prose, email, and authentication fields", () => {
  const result = {
    ...matchedResult(),
    rawExtraction: "PRIVATE_RAW_EXTRACTION",
    profileProse: "PRIVATE_PROFILE_PROSE",
    email: "PRIVATE_EMAIL",
    token: "PRIVATE_TOKEN",
  } as unknown as OwnedJobMatchResult;
  const html = render(result);

  assert.doesNotMatch(
    html,
    /PRIVATE_RAW_EXTRACTION|PRIVATE_PROFILE_PROSE|PRIVATE_EMAIL|PRIVATE_TOKEN/,
  );
});

test("uses semantic section headings and responsive grids", () => {
  const html = render(matchedResult());

  assert.match(html, /<section aria-labelledby="profile-match-required"/);
  assert.match(html, /<h3 id="profile-match-required"/);
  assert.match(html, /xl:grid-cols-3/);
  assert.match(html, /md:grid-cols-2/);
});

test("Job Detail retains existing controls while adding one profile-match section", () => {
  const page = readFileSync("app/(app)/jobs/[id]/page.tsx", "utf8");

  assert.match(page, /<PrivateJobControls job=\{job\}/);
  assert.match(page, /<JobAnalysisControl/);
  assert.match(page, /<ManualJobDescriptionForm/);
  assert.equal((page.match(/title="Profile match"/g) ?? []).length, 1);
  assert.equal((page.match(/getOwnedJobMatch\(job\.id\)/g) ?? []).length, 1);
});
