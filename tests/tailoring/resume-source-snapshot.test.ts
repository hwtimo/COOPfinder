import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { MasterProfileData } from "../../lib/master-profile/types";
import { buildResumeSourceSnapshot } from "../../lib/tailoring/resume-source-snapshot";

const APPROVED_ID = "11111111-1111-4111-8111-111111111111";
const UNAPPROVED_ID = "22222222-2222-4222-8222-222222222222";

function profile(): MasterProfileData {
  return {
    fullName: " Ada   Lovelace ",
    email: "ada@example.test",
    school: "SFU",
    program: "Computing Science",
    gradYear: "2027",
    coopTerm: "Seeking Summer 2027",
    workAuthorization: "Canadian work authorization",
    preferredLocations: ["PRIVATE PREFERENCE"],
    targetRoles: ["PRIVATE TARGET"],
    skills: [" TypeScript ", "typescript", "SQL"],
    candidateEvidence: {
      technologies: ["React"],
      softSkills: ["Communication"],
      certifications: ["AWS Certified Cloud Practitioner"],
      languages: [{ language: "French", proficiency: "professional" }],
    },
    entries: [
      {
        id: "PRIVATE_DATABASE_ID",
        section: "project",
        source: " Analytics   dashboard ",
        text: "PRIVATE RAW ENTRY PROSE 999",
        skills: ["PRIVATE ENTRY SKILL"],
        confirmed: true,
        sortOrder: 0,
        resumeFragments: [
          {
            fragmentId: UNAPPROVED_ID,
            text: "Unapproved private bullet",
            evidenceTags: [],
            confirmed: false,
            order: 1,
            provenance: "manual",
          },
          {
            fragmentId: APPROVED_ID,
            text: "Improved 12 dashboards by 25%.",
            evidenceTags: ["React", "Analytics"],
            confirmed: true,
            order: 0,
            provenance: "manual",
          },
        ],
      },
      {
        id: "PRIVATE_UNCONFIRMED_ENTRY_ID",
        section: "experience",
        source: "Unconfirmed entry",
        text: "PRIVATE UNCONFIRMED PROSE",
        skills: [],
        confirmed: false,
        sortOrder: 1,
        resumeFragments: [
          {
            fragmentId: "33333333-3333-4333-8333-333333333333",
            text: "Fragment on unconfirmed entry",
            evidenceTags: [],
            confirmed: true,
            order: 0,
            provenance: "manual",
          },
        ],
      },
      {
        id: "GUEST_IMPORT_ENTRY",
        section: "project",
        source: "Guest import",
        text: "GUEST IMPORT PROSE",
        skills: [],
        confirmed: true,
        sortOrder: 2,
      },
    ],
  };
}

test("builds a deterministic safe snapshot from explicit approved fragments", () => {
  const input = profile();
  const original = structuredClone(input);
  const first = buildResumeSourceSnapshot(input);
  const second = buildResumeSourceSnapshot(input);
  assert.deepEqual(first, second);
  assert.deepEqual(input, original);
  assert.equal(first.status, "ready");
  if (first.status !== "ready") return;

  assert.deepEqual(first.snapshot.identity, {
    fullName: "Ada Lovelace",
    email: "ada@example.test",
  });
  assert.deepEqual(first.snapshot.education, {
    school: "SFU",
    program: "Computing Science",
    gradYear: "2027",
    coopTerm: "Seeking Summer 2027",
  });
  assert.deepEqual(first.snapshot.skills, ["TypeScript", "SQL"]);
  assert.deepEqual(first.snapshot.entries, [
    {
      section: "project",
      heading: "Analytics dashboard",
      fragments: [
        {
          fragmentId: APPROVED_ID,
          text: "Improved 12 dashboards by 25%.",
          evidenceTags: ["React", "Analytics"],
          confirmed: true,
          order: 0,
          provenance: "manual",
        },
      ],
    },
  ]);
});

test("snapshot excludes raw prose, unconfirmed content, IDs, and unrelated data", () => {
  const result = buildResumeSourceSnapshot(profile());
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  const serialized = JSON.stringify(result.snapshot);
  for (const marker of [
    "PRIVATE RAW ENTRY PROSE",
    "Unapproved private bullet",
    "PRIVATE UNCONFIRMED PROSE",
    "Fragment on unconfirmed entry",
    "GUEST IMPORT PROSE",
    "PRIVATE_DATABASE_ID",
    "PRIVATE PREFERENCE",
    "PRIVATE TARGET",
    "PRIVATE ENTRY SKILL",
  ]) {
    assert.equal(serialized.includes(marker), false);
  }
  assert.doesNotMatch(
    serialized,
    /userId|profileId|entryId|job|provider|resumeVersion|generated/i,
  );
});

test("exact numeric source text and explicit candidate evidence are preserved", () => {
  const result = buildResumeSourceSnapshot(profile());
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(
    result.snapshot.entries[0]?.fragments[0]?.text,
    "Improved 12 dashboards by 25%.",
  );
  assert.deepEqual(result.snapshot.candidateEvidence, {
    technologies: ["React"],
    softSkills: ["Communication"],
    certifications: ["AWS Certified Cloud Practitioner"],
    languages: [{ language: "French", proficiency: "professional" }],
  });
});

test("old profiles without fragments produce a safe empty entry collection", () => {
  const input = profile();
  input.entries = input.entries.map((entry) => {
    const legacyEntry = { ...entry };
    delete legacyEntry.resumeFragments;
    return legacyEntry;
  });
  const result = buildResumeSourceSnapshot(input);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.deepEqual(result.snapshot.entries, []);
});

test("malformed optional fragment or candidate evidence fails safely", () => {
  const malformedFragments = profile() as unknown as Record<string, unknown>;
  (malformedFragments.entries as Array<Record<string, unknown>>)[0]!.resumeFragments = [
    { fragmentId: APPROVED_ID, text: "Missing strict keys" },
  ];
  assert.deepEqual(
    buildResumeSourceSnapshot(malformedFragments as unknown as MasterProfileData),
    { status: "invalid_profile" },
  );

  const malformedEvidence = profile() as unknown as Record<string, unknown>;
  malformedEvidence.candidateEvidence = { technologies: "React" };
  assert.deepEqual(
    buildResumeSourceSnapshot(malformedEvidence as unknown as MasterProfileData),
    { status: "invalid_profile" },
  );
});

test("snapshot module is pure and has no server, provider, credit, or persistence dependency", () => {
  const source = readFileSync(
    "lib/tailoring/resume-source-snapshot.ts",
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /server-only|supabase|fetch\(|openai|provider|credit|reservation|resume_versions|insert\(|update\(|upsert\(|delete\(|console\./i,
  );
});
