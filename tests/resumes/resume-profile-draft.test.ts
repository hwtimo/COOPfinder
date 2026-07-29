import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSupportedResumeProfileDraft,
  generateResumeProfileDraft,
  MAX_RESUME_PROFILE_DRAFT_INPUT_CHARACTERS,
} from "../../lib/resumes/generate-resume-profile-draft";
import {
  RESUME_PROFILE_DRAFT_CONTRACT_VERSION,
  resumeProfileDraftOutputV1Schema,
} from "../../lib/resumes/resume-profile-draft-contract";
import type { ResumeProfileDraftProvider } from "../../lib/resumes/resume-profile-draft-provider";

const RESUME_TEXT = `
EDUCATION
Simon Fraser University — BSc Computing Science, 2027

WORK EXPERIENCE
Frontend Developer, Example Co.
Built accessible React interfaces with TypeScript.

PROJECTS
Transit planner
Created a TypeScript route-planning application.

LEADERSHIP
Peer mentor for first-year students.
`.trim();

function validOutput() {
  return {
    contractVersion: RESUME_PROFILE_DRAFT_CONTRACT_VERSION,
    education: [
      {
        text: "Simon Fraser University — BSc Computing Science, 2027",
        skills: [],
      },
    ],
    skills: ["React", "TypeScript"],
    workExperience: [
      {
        text: "Built accessible React interfaces with TypeScript.",
        skills: ["React", "TypeScript"],
      },
    ],
    projects: [
      {
        text: "Created a TypeScript route-planning application.",
        skills: ["TypeScript"],
      },
    ],
    leadershipActivities: [
      {
        text: "Peer mentor for first-year students.",
        skills: [],
      },
    ],
  };
}

function providerReturning(
  output: ReturnType<typeof validOutput>,
  onCall?: (text: string) => void,
): ResumeProfileDraftProvider {
  return {
    async generateDraft(text) {
      onCall?.(text);
      return { status: "output", output };
    },
  };
}

test("strict versioned output supports only the requested draft categories", () => {
  assert.equal(resumeProfileDraftOutputV1Schema.safeParse(validOutput()).success, true);
  assert.equal(
    resumeProfileDraftOutputV1Schema.safeParse({
      ...validOutput(),
      confirmed: true,
    }).success,
    false,
  );
  assert.equal(
    resumeProfileDraftOutputV1Schema.safeParse({
      ...validOutput(),
      education: [
        {
          ...validOutput().education[0],
          confirmed: true,
        },
      ],
    }).success,
    false,
  );
});

test("builds only verbatim supported evidence and forces every entry unconfirmed", () => {
  const draft = buildSupportedResumeProfileDraft(validOutput(), RESUME_TEXT);
  assert.ok(draft);
  assert.equal(draft.contractVersion, RESUME_PROFILE_DRAFT_CONTRACT_VERSION);
  assert.deepEqual(draft.skills, ["React", "TypeScript"]);
  assert.deepEqual(
    [
      ...draft.education,
      ...draft.workExperience,
      ...draft.projects,
      ...draft.leadershipActivities,
    ].map(({ section, source, confirmed }) => ({
      section,
      source,
      confirmed,
    })),
    [
      {
        section: "education",
        source: "Resume upload draft",
        confirmed: false,
      },
      {
        section: "experience",
        source: "Resume upload draft",
        confirmed: false,
      },
      {
        section: "project",
        source: "Resume upload draft",
        confirmed: false,
      },
      {
        section: "volunteer",
        source: "Resume upload draft",
        confirmed: false,
      },
    ],
  );
});

test("rejects unsupported or invented claims instead of partially accepting them", async () => {
  const inventedEmployer = {
    ...validOutput(),
    workExperience: [
      {
        text: "Senior Engineer at Invented Corporation",
        skills: ["TypeScript"],
      },
    ],
  };
  assert.equal(
    buildSupportedResumeProfileDraft(inventedEmployer, RESUME_TEXT),
    null,
  );

  const inventedSkill = {
    ...validOutput(),
    skills: ["Kubernetes"],
  };
  assert.equal(buildSupportedResumeProfileDraft(inventedSkill, RESUME_TEXT), null);

  const result = await generateResumeProfileDraft(
    RESUME_TEXT,
    providerReturning(inventedEmployer as ReturnType<typeof validOutput>),
  );
  assert.deepEqual(result, { status: "invalid_output" });
});

test("normalizes whitespace, deduplicates stably, and preserves first-seen spelling", () => {
  const output = {
    ...validOutput(),
    skills: ["React", " react ", "TypeScript"],
    projects: [
      {
        text: "Created a TypeScript route-planning application.",
        skills: ["TypeScript", " typescript "],
      },
      {
        text: " Created a TypeScript route-planning application. ",
        skills: [],
      },
    ],
  };
  const draft = buildSupportedResumeProfileDraft(output, RESUME_TEXT);
  assert.ok(draft);
  assert.deepEqual(draft.skills, ["React", "TypeScript"]);
  assert.equal(draft.projects.length, 1);
  assert.deepEqual(draft.projects[0]?.skills, ["TypeScript"]);
});

test("bounds provider input and makes no call for invalid text", async () => {
  let calls = 0;
  const provider = providerReturning(validOutput(), () => {
    calls += 1;
  });

  assert.deepEqual(await generateResumeProfileDraft("   ", provider), {
    status: "invalid_input",
    reason: "empty_text",
  });
  assert.deepEqual(
    await generateResumeProfileDraft(
      "x".repeat(MAX_RESUME_PROFILE_DRAFT_INPUT_CHARACTERS + 1),
      provider,
    ),
    { status: "invalid_input", reason: "text_too_long" },
  );
  assert.equal(calls, 0);

  const success = await generateResumeProfileDraft(RESUME_TEXT, provider);
  assert.equal(success.status, "success");
  assert.equal(calls, 1);
});

test("orchestration and action are temporary and contain no persistence or credit path", () => {
  const source = [
    readFileSync("lib/resumes/generate-resume-profile-draft.ts", "utf8"),
    readFileSync("app/(app)/resumes/actions.ts", "utf8"),
  ].join("\n");
  assert.doesNotMatch(
    source,
    /\.from\(|\.rpc\(|insert\(|update\(|upsert\(|delete\(|storage|reservation|credit|resume_fragments/i,
  );
  assert.match(source, /await extractResumePdf\(file\)/);
  assert.match(source, /await generateResumeProfileDraft\(result\.text\)/);
  assert.doesNotMatch(source, /confirmed:\s*true/);
});
