import {
  SCHOOL_OPTIONS,
  WORK_AUTHORIZATION_OPTIONS,
} from "@/lib/guest-draft/types";
import { parseCandidateEvidence } from "@/lib/master-profile/candidate-evidence";
import { parseResumeSourceFragments } from "@/lib/master-profile/resume-source-fragments";

import {
  MASTER_PROFILE_SECTIONS,
  type MasterProfileEntry,
  type MasterProfileSavePayload,
  type MasterProfileSection,
} from "./types";

type ValidationResult =
  | { ok: true; data: MasterProfileSavePayload }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== "string") throw new Error(`${label} is invalid.`);
  const cleaned = value.trim();
  if (cleaned.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return cleaned;
}

function stringArray(
  value: unknown,
  label: string,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${label} has too many items.`);
  }

  const seen = new Set<string>();
  return value.reduce<string[]>((result, item) => {
    const cleaned = stringValue(item, label, maxLength);
    if (!cleaned) return result;
    const key = cleaned.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
    return result;
  }, []);
}

function entryValue(value: unknown, index: number): MasterProfileEntry {
  if (!isRecord(value)) throw new Error(`Entry ${index + 1} is invalid.`);
  const section = value.section;
  if (
    typeof section !== "string" ||
    !MASTER_PROFILE_SECTIONS.includes(section as MasterProfileSection)
  ) {
    throw new Error(`Entry ${index + 1} has an invalid type.`);
  }
  const source = stringValue(value.source, `Entry ${index + 1} title`, 160);
  const text = stringValue(value.text, `Entry ${index + 1} description`, 5_000);
  if (!source || !text) {
    throw new Error(`Entry ${index + 1} needs a title and description.`);
  }
  const resumeFragments = parseResumeSourceFragments(value.resumeFragments);
  if (resumeFragments.status === "invalid") {
    throw new Error(`Entry ${index + 1} resume bullets are invalid.`);
  }

  return {
    id: typeof value.id === "string" ? value.id.slice(0, 120) : `entry-${index}`,
    section: section as MasterProfileSection,
    source,
    text,
    skills: stringArray(value.skills, `Entry ${index + 1} skills`, 30, 80),
    confirmed: value.confirmed === true,
    sortOrder: index,
    ...(resumeFragments.status === "valid"
      ? { resumeFragments: resumeFragments.fragments }
      : {}),
  };
}

export function validateMasterProfilePayload(value: unknown): ValidationResult {
  try {
    if (!isRecord(value)) throw new Error("The profile form is invalid.");
    if (!Array.isArray(value.entries) || value.entries.length > 100) {
      throw new Error("The profile has too many entries.");
    }

    const school = stringValue(value.school, "School", 40);
    if (school && !SCHOOL_OPTIONS.includes(school as (typeof SCHOOL_OPTIONS)[number])) {
      throw new Error("Choose a listed school.");
    }
    const workAuthorization = stringValue(
      value.workAuthorization,
      "Work authorization",
      80,
    );
    if (
      workAuthorization &&
      !WORK_AUTHORIZATION_OPTIONS.includes(
        workAuthorization as (typeof WORK_AUTHORIZATION_OPTIONS)[number],
      )
    ) {
      throw new Error("Choose a listed work authorization option.");
    }
    const gradYear = stringValue(value.gradYear, "Graduation year", 4);
    if (gradYear && (!/^\d{4}$/.test(gradYear) || Number(gradYear) < 2000 || Number(gradYear) > 2200)) {
      throw new Error("Enter a valid four-digit graduation year.");
    }

    const candidateEvidence = parseCandidateEvidence(value.candidateEvidence);
    if (candidateEvidence.status === "invalid") {
      throw new Error("Skills and credentials are invalid.");
    }

    return {
      ok: true,
      data: {
        fullName: stringValue(value.fullName, "Full name", 160),
        school,
        program: stringValue(value.program, "Program", 120),
        gradYear,
        coopTerm: stringValue(value.coopTerm, "Current term", 80),
        workAuthorization,
        preferredLocations: stringArray(
          value.preferredLocations,
          "Preferred locations",
          12,
          80,
        ),
        targetRoles: stringArray(value.targetRoles, "Target roles", 12, 80),
        skills: stringArray(value.skills, "Skills", 60, 80),
        entries: value.entries.map(entryValue),
        ...(candidateEvidence.status === "valid"
          ? { candidateEvidence: candidateEvidence.evidence }
          : {}),
      },
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Review the profile and try again.",
    };
  }
}
