import "server-only";

import type {
  MasterProfileData,
  MasterProfileEntry,
  MasterProfileSavePayload,
  MasterProfileSaveState,
} from "@/lib/master-profile/types";

import {
  resumeProfileDraftV1Schema,
  type ResumeProfileDraftEntry,
  type ResumeProfileDraftV1,
} from "./resume-profile-draft-contract";

export type ImportResumeProfileDraftResult =
  | {
      status: "success";
      importedEntries: number;
      skippedDuplicates: number;
    }
  | { status: "invalid_draft" | "profile_unavailable" | "persistence_unavailable" };

type ImportDependencies = Readonly<{
  loadProfile(
    userId: string,
    email: string,
  ): Promise<{ status: "ready" | "error"; data: MasterProfileData }>;
  saveProfile(payload: MasterProfileSavePayload): Promise<MasterProfileSaveState>;
}>;

function normalizedKey(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-CA");
}

function entryKey(entry: Pick<MasterProfileEntry, "section" | "text">) {
  return `${entry.section}:${normalizedKey(entry.text)}`;
}

function asUnconfirmedEntry(
  entry: ResumeProfileDraftEntry,
  index: number,
): MasterProfileEntry {
  return {
    id: `resume-draft-import-${index + 1}`,
    section: entry.section,
    source: "Resume upload draft",
    text: entry.text.replace(/\s+/g, " ").trim(),
    skills: entry.skills.map((skill) => skill.replace(/\s+/g, " ").trim()),
    confirmed: false,
    sortOrder: index,
    resumeFragments: [],
  };
}

export function mergeResumeProfileDraft(
  profile: MasterProfileData,
  draft: ResumeProfileDraftV1,
): {
  payload: MasterProfileSavePayload;
  importedEntries: number;
  skippedDuplicates: number;
} {
  const existingEntries = profile.entries.map((entry, index) => ({
    ...entry,
    skills: [...entry.skills],
    sortOrder: index,
    ...(entry.resumeFragments === undefined
      ? {}
      : { resumeFragments: [...entry.resumeFragments] }),
  }));
  const seenEntries = new Set(existingEntries.map(entryKey));
  const existingGeneralSkills = new Set(
    profile.skills.map((skill) => normalizedKey(skill)),
  );
  const draftEntries: ResumeProfileDraftEntry[] = [
    ...draft.education,
    ...draft.workExperience,
    ...draft.projects,
    ...draft.leadershipActivities,
    ...draft.skills
      .filter((skill) => !existingGeneralSkills.has(normalizedKey(skill)))
      .map(
        (skill, index): ResumeProfileDraftEntry => ({
          temporaryId: `resume-draft-skill-${index + 1}`,
          section: "skills",
          source: "Resume upload draft",
          text: skill,
          skills: [skill],
          confirmed: false,
          sortOrder: index,
        }),
      ),
  ];

  let skippedDuplicates =
    draft.skills.length -
    draftEntries.filter((entry) => entry.section === "skills").length;
  const imported: MasterProfileEntry[] = [];
  for (const draftEntry of draftEntries) {
    const entry = asUnconfirmedEntry(
      draftEntry,
      existingEntries.length + imported.length,
    );
    const key = entryKey(entry);
    if (seenEntries.has(key)) {
      skippedDuplicates += 1;
      continue;
    }
    seenEntries.add(key);
    imported.push(entry);
  }

  return {
    payload: {
      fullName: profile.fullName,
      school: profile.school,
      program: profile.program,
      gradYear: profile.gradYear,
      coopTerm: profile.coopTerm,
      workAuthorization: profile.workAuthorization,
      preferredLocations: [...profile.preferredLocations],
      targetRoles: [...profile.targetRoles],
      skills: [...profile.skills],
      entries: [...existingEntries, ...imported].map((entry, index) => ({
        ...entry,
        sortOrder: index,
      })),
      ...(profile.candidateEvidence === undefined
        ? {}
        : { candidateEvidence: profile.candidateEvidence }),
    },
    importedEntries: imported.length,
    skippedDuplicates,
  };
}

export async function importResumeProfileDraft(
  user: Readonly<{ id: string; email: string }>,
  input: unknown,
  dependencies: ImportDependencies,
): Promise<ImportResumeProfileDraftResult> {
  const parsedDraft = resumeProfileDraftV1Schema.safeParse(input);
  if (!parsedDraft.success) return { status: "invalid_draft" };

  const loaded = await dependencies.loadProfile(user.id, user.email);
  if (loaded.status !== "ready") return { status: "profile_unavailable" };

  const merged = mergeResumeProfileDraft(loaded.data, parsedDraft.data);
  if (merged.importedEntries === 0) {
    return {
      status: "success",
      importedEntries: 0,
      skippedDuplicates: merged.skippedDuplicates,
    };
  }

  const saved = await dependencies.saveProfile(merged.payload);
  if (saved.status !== "success") return { status: "persistence_unavailable" };
  return {
    status: "success",
    importedEntries: merged.importedEntries,
    skippedDuplicates: merged.skippedDuplicates,
  };
}
