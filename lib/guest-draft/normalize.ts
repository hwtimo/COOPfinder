import {
  GUEST_DRAFT_VERSION,
  SCHOOL_OPTIONS,
  WORK_AUTHORIZATION_OPTIONS,
  type GuestDraftEntry,
  type GuestDraftProfile,
  type GuestDraftV1,
  type GuestEntrySection,
  type GuestSchool,
  type GuestWorkAuthorization,
  type StashedGuestJob,
} from "./types";

const ENTRY_SECTIONS: GuestEntrySection[] = [
  "experience",
  "project",
  "education",
  "skills",
];

export type CanonicalGuestDraft = {
  version: typeof GUEST_DRAFT_VERSION;
  profile: GuestDraftProfile;
  skills: string[];
  entries: Array<Pick<GuestDraftEntry, "section" | "title" | "text" | "skills">>;
  stashedJobs: Array<Pick<StashedGuestJob, "inputType" | "url" | "text">>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || undefined;
}

function cleanStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const cleaned = cleanString(item, maxLength);
    if (!cleaned) continue;
    const key = cleaned.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }

  return result;
}

function isOption<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function normalizeProfile(value: unknown): GuestDraftProfile {
  if (!isRecord(value)) return {};
  const school = isOption<GuestSchool>(value.school, SCHOOL_OPTIONS)
    ? value.school
    : undefined;
  const workAuthorization = isOption<GuestWorkAuthorization>(
    value.workAuthorization,
    WORK_AUTHORIZATION_OPTIONS,
  )
    ? value.workAuthorization
    : undefined;
  const program = cleanString(value.program, 120);
  const coopTerm = cleanString(value.coopTerm, 80);
  const targetRoles = cleanStringArray(value.targetRoles, 12, 80);
  const preferredLocations = cleanStringArray(value.preferredLocations, 12, 80);

  return {
    ...(school ? { school } : {}),
    ...(program ? { program } : {}),
    ...(coopTerm ? { coopTerm } : {}),
    ...(workAuthorization ? { workAuthorization } : {}),
    ...(targetRoles.length ? { targetRoles } : {}),
    ...(preferredLocations.length ? { preferredLocations } : {}),
  };
}

function normalizeEntry(value: unknown): GuestDraftEntry | null {
  if (!isRecord(value)) return null;
  const id = cleanString(value.id, 120);
  const section = isOption<GuestEntrySection>(value.section, ENTRY_SECTIONS)
    ? value.section
    : undefined;
  const title = cleanString(value.title, 160) ?? "";
  const text = cleanString(value.text, 2_000) ?? "";
  if (!id || !section || (!title && !text)) return null;

  return {
    id,
    section,
    title,
    text,
    skills: cleanStringArray(value.skills, 30, 80),
  };
}

function normalizeStashedJob(value: unknown): StashedGuestJob | null {
  if (!isRecord(value)) return null;
  const id = cleanString(value.id, 120);
  const inputType =
    value.inputType === "url" || value.inputType === "text"
      ? value.inputType
      : undefined;
  const url = cleanString(value.url, 2_048);
  const text = cleanString(value.text, 12_000);
  const addedAt = cleanString(value.addedAt, 64);
  if (!id || !inputType || !addedAt) return null;
  if (inputType === "url" && !url) return null;
  if (inputType === "text" && !text) return null;

  return {
    id,
    inputType,
    ...(url ? { url } : {}),
    ...(text ? { text } : {}),
    addedAt,
  };
}

export function normalizeGuestDraft(value: unknown): GuestDraftV1 | null {
  if (!isRecord(value) || value.version !== GUEST_DRAFT_VERSION) return null;

  const updatedAt = cleanString(value.updatedAt, 64) ?? new Date().toISOString();
  const entries = Array.isArray(value.entries)
    ? value.entries
        .map(normalizeEntry)
        .filter((entry): entry is GuestDraftEntry => entry !== null)
        .slice(0, 40)
    : [];
  const stashedJobs = Array.isArray(value.stashedJobs)
    ? value.stashedJobs
        .map(normalizeStashedJob)
        .filter((job): job is StashedGuestJob => job !== null)
        .slice(0, 20)
    : [];

  return {
    version: GUEST_DRAFT_VERSION,
    updatedAt,
    profile: normalizeProfile(value.profile),
    skills: cleanStringArray(value.skills, 60, 80),
    entries,
    stashedJobs,
  };
}

export function guestDraftHasValue(draft: GuestDraftV1): boolean {
  return (
    Object.keys(draft.profile).length > 0 ||
    draft.skills.length > 0 ||
    draft.entries.length > 0 ||
    draft.stashedJobs.length > 0
  );
}

export function isValidGuestJobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      value.length <= 2_048 &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export function canonicalizeGuestDraft(
  draft: GuestDraftV1,
): CanonicalGuestDraft | null {
  if (
    draft.stashedJobs.some(
      (job) => job.url !== undefined && !isValidGuestJobUrl(job.url),
    )
  ) {
    return null;
  }

  return {
    version: GUEST_DRAFT_VERSION,
    profile: draft.profile,
    skills: draft.skills,
    entries: draft.entries.map(({ section, title, text, skills }) => ({
      section,
      title,
      text,
      skills,
    })),
    stashedJobs: draft.stashedJobs.map(({ inputType, url, text }) => ({
      inputType,
      ...(url ? { url } : {}),
      ...(text ? { text } : {}),
    })),
  };
}
