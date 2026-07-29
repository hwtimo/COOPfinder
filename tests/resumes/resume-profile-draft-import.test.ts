import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  MasterProfileData,
  MasterProfileSavePayload,
} from "../../lib/master-profile/types";
import {
  importResumeProfileDraft,
  mergeResumeProfileDraft,
} from "../../lib/resumes/import-resume-profile-draft";
import {
  RESUME_PROFILE_DRAFT_CONTRACT_VERSION,
  resumeProfileDraftV1Schema,
  type ResumeProfileDraftV1,
} from "../../lib/resumes/resume-profile-draft-contract";

const EXISTING_ENTRY_ID = "11111111-1111-4111-8111-111111111111";
const FRAGMENT_ID = "22222222-2222-4222-8222-222222222222";

function profile(): MasterProfileData {
  return {
    fullName: "Existing User",
    email: "existing@example.invalid",
    school: "Simon Fraser University",
    program: "Computing Science",
    gradYear: "2027",
    coopTerm: "Seeking Spring/Summer 2026",
    workAuthorization: "Canadian citizen",
    preferredLocations: ["Vancouver"],
    targetRoles: ["Software Developer"],
    skills: ["TypeScript"],
    entries: [
      {
        id: EXISTING_ENTRY_ID,
        section: "experience",
        source: "Existing role",
        text: "Built accessible React interfaces.",
        skills: ["React"],
        confirmed: true,
        sortOrder: 0,
        resumeFragments: [
          {
            fragmentId: FRAGMENT_ID,
            text: "Built accessible React interfaces.",
            evidenceTags: ["React"],
            confirmed: true,
            order: 0,
            provenance: "manual",
          },
        ],
      },
    ],
    candidateEvidence: {
      technologies: ["React"],
      softSkills: ["Communication"],
    },
  };
}

function draft(): ResumeProfileDraftV1 {
  return {
    contractVersion: RESUME_PROFILE_DRAFT_CONTRACT_VERSION,
    skills: ["TypeScript", "Node.js"],
    education: [
      {
        temporaryId: "resume-draft-education-1",
        section: "education",
        source: "Resume upload draft",
        text: "BSc Computing Science, 2027",
        skills: [],
        confirmed: false,
        sortOrder: 0,
      },
    ],
    workExperience: [
      {
        temporaryId: "resume-draft-experience-1",
        section: "experience",
        source: "Resume upload draft",
        text: "Implemented APIs with Node.js.",
        skills: ["Node.js"],
        confirmed: false,
        sortOrder: 0,
      },
    ],
    projects: [],
    leadershipActivities: [],
  };
}

test("imports every AI item as unconfirmed review evidence", () => {
  const merged = mergeResumeProfileDraft(profile(), draft());
  const imported = merged.payload.entries.slice(1);

  assert.equal(merged.importedEntries, 3);
  assert.equal(imported.every((entry) => entry.confirmed === false), true);
  assert.deepEqual(
    imported.map(({ section, text }) => ({ section, text })),
    [
      { section: "education", text: "BSc Computing Science, 2027" },
      { section: "experience", text: "Implemented APIs with Node.js." },
      { section: "skills", text: "Node.js" },
    ],
  );
  assert.equal(
    imported.every(
      (entry) =>
        Array.isArray(entry.resumeFragments) &&
        entry.resumeFragments.length === 0,
    ),
    true,
  );
});

test("preserves populated profile fields, confirmed entries, and approved fragments", () => {
  const existing = profile();
  const snapshot = structuredClone(existing);
  const merged = mergeResumeProfileDraft(existing, draft());

  assert.deepEqual(existing, snapshot);
  assert.equal(merged.payload.fullName, snapshot.fullName);
  assert.deepEqual(merged.payload.skills, snapshot.skills);
  assert.deepEqual(merged.payload.candidateEvidence, snapshot.candidateEvidence);
  assert.deepEqual(merged.payload.entries[0], snapshot.entries[0]);
  assert.equal(merged.payload.entries[0]?.confirmed, true);
  assert.equal(
    merged.payload.entries[0]?.resumeFragments?.[0]?.confirmed,
    true,
  );
});

test("skips normalized entry and top-level skill duplicates", () => {
  const duplicateDraft: ResumeProfileDraftV1 = {
    ...draft(),
    skills: [" typescript ", "Node.js", " node.JS "],
    workExperience: [
      {
        temporaryId: "resume-draft-experience-duplicate",
        section: "experience",
        source: "Resume upload draft",
        text: "  built   accessible react interfaces. ",
        skills: ["React"],
        confirmed: false,
        sortOrder: 0,
      },
    ],
  };
  const merged = mergeResumeProfileDraft(profile(), duplicateDraft);

  assert.equal(merged.skippedDuplicates, 3);
  assert.equal(
    merged.payload.entries.filter(
      (entry) => entry.section === "skills" && entry.text === "Node.js",
    ).length,
    1,
  );
  assert.equal(
    merged.payload.entries.filter(
      (entry) =>
        entry.section === "experience" &&
        entry.text.toLocaleLowerCase("en-CA").includes("accessible react"),
    ).length,
    1,
  );
});

test("strict import contract rejects confirmed or fragment-bearing client payloads", () => {
  const confirmedDraft = structuredClone(draft()) as unknown as Record<
    string,
    unknown
  >;
  const education = confirmedDraft.education as Array<Record<string, unknown>>;
  education[0]!.confirmed = true;
  assert.equal(resumeProfileDraftV1Schema.safeParse(confirmedDraft).success, false);

  const fragmentDraft = structuredClone(draft()) as unknown as Record<
    string,
    unknown
  >;
  const fragmentEducation = fragmentDraft.education as Array<
    Record<string, unknown>
  >;
  fragmentEducation[0]!.resumeFragments = [];
  assert.equal(resumeProfileDraftV1Schema.safeParse(fragmentDraft).success, false);
});

test("failed persistence returns safely with no partial or repeated write", async () => {
  const existing = profile();
  const snapshot = structuredClone(existing);
  const payloads: MasterProfileSavePayload[] = [];
  const result = await importResumeProfileDraft(
    { id: "owner-id", email: "owner@example.invalid" },
    draft(),
    {
      async loadProfile() {
        return { status: "ready", data: existing };
      },
      async saveProfile(payload) {
        payloads.push(payload);
        return { status: "error", message: "safe failure" };
      },
    },
  );

  assert.deepEqual(result, { status: "persistence_unavailable" });
  assert.equal(payloads.length, 1);
  assert.deepEqual(existing, snapshot);
});

test("invalid drafts and unavailable profiles never reach persistence", async () => {
  let saves = 0;
  const dependencies = {
    async loadProfile() {
      return { status: "error" as const, data: profile() };
    },
    async saveProfile() {
      saves += 1;
      return { status: "success" as const, message: "saved" };
    },
  };

  assert.deepEqual(
    await importResumeProfileDraft(
      { id: "owner-id", email: "owner@example.invalid" },
      { ...draft(), unknown: true },
      dependencies,
    ),
    { status: "invalid_draft" },
  );
  assert.deepEqual(
    await importResumeProfileDraft(
      { id: "owner-id", email: "owner@example.invalid" },
      draft(),
      dependencies,
    ),
    { status: "profile_unavailable" },
  );
  assert.equal(saves, 0);
});

test("server action uses the existing atomic save path and no AI or credit path", () => {
  const action = readFileSync("app/(app)/resumes/actions.ts", "utf8");
  const importAction = action.slice(
    action.indexOf("export async function importResumeProfileDraftAction"),
  );
  const importer = readFileSync(
    "lib/resumes/import-resume-profile-draft.ts",
    "utf8",
  );
  const form = readFileSync(
    "components/resumes/resume-profile-draft-import-form.tsx",
    "utf8",
  );

  assert.match(action, /await getSupabaseUser\(\)/);
  assert.match(action, /saveMasterProfileAction/);
  assert.match(action, /redirect\("\/resumes\/master"\)/);
  assert.match(form, /Import draft for review/);
  assert.match(form, /stay unconfirmed/);
  assert.doesNotMatch(
    `${importAction}\n${importer}\n${form}`,
    /OpenAI|generateResumeProfileDraft\(|approved|confirmed:\s*true|credit|OCR/i,
  );
  assert.doesNotMatch(importer, /\.from\(|\.rpc\(|insert\(|update\(|upsert\(/);
});
