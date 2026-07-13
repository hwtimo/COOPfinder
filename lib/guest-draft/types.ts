export const GUEST_DRAFT_STORAGE_KEY = "coopfinder.guest_draft.v1";
export const INTAKE_INTENT_SESSION_KEY =
  "coopfinder.job_intake_intent.v1";

export const GUEST_DRAFT_VERSION = 1 as const;
export const INTAKE_INTENT_VERSION = 1 as const;

export const SCHOOL_OPTIONS = ["SFU", "UBC", "Waterloo", "Other"] as const;
export const WORK_AUTHORIZATION_OPTIONS = [
  "Canadian work authorization",
  "Domestic students",
  "International eligible",
] as const;

export type GuestSchool = (typeof SCHOOL_OPTIONS)[number];
export type GuestWorkAuthorization =
  (typeof WORK_AUTHORIZATION_OPTIONS)[number];
export type GuestEntrySection =
  | "experience"
  | "project"
  | "education"
  | "skills";
export type JobIntakeType = "url" | "text";

export type GuestDraftProfile = {
  school?: GuestSchool;
  program?: string;
  coopTerm?: string;
  workAuthorization?: GuestWorkAuthorization;
  targetRoles?: string[];
  preferredLocations?: string[];
};

export type GuestDraftEntry = {
  id: string;
  section: GuestEntrySection;
  title: string;
  text: string;
  skills: string[];
};

export type StashedGuestJob = {
  id: string;
  inputType: JobIntakeType;
  url?: string;
  text?: string;
  addedAt: string;
};

export type GuestDraftV1 = {
  version: typeof GUEST_DRAFT_VERSION;
  updatedAt: string;
  profile: GuestDraftProfile;
  skills: string[];
  entries: GuestDraftEntry[];
  stashedJobs: StashedGuestJob[];
};

export type IntakeIntentV1 = {
  version: typeof INTAKE_INTENT_VERSION;
  id: string;
  inputType: JobIntakeType;
  url?: string;
  text?: string;
  createdAt: string;
  expiresAt: string;
};

export function createEmptyGuestDraft(
  now = new Date().toISOString(),
): GuestDraftV1 {
  return {
    version: GUEST_DRAFT_VERSION,
    updatedAt: now,
    profile: {},
    skills: [],
    entries: [],
    stashedJobs: [],
  };
}

export function createLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
