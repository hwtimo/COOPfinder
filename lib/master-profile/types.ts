export const MASTER_PROFILE_SECTIONS = [
  "experience",
  "project",
  "education",
  "skills",
  "certification",
  "volunteer",
] as const;

export type MasterProfileSection = (typeof MASTER_PROFILE_SECTIONS)[number];

export type MasterProfileEntry = {
  id: string;
  section: MasterProfileSection;
  source: string;
  text: string;
  skills: string[];
  confirmed: boolean;
  sortOrder: number;
};

export type MasterProfileData = {
  fullName: string;
  email: string;
  school: string;
  program: string;
  gradYear: string;
  coopTerm: string;
  workAuthorization: string;
  preferredLocations: string[];
  targetRoles: string[];
  skills: string[];
  entries: MasterProfileEntry[];
};

export type MasterProfileSavePayload = Omit<MasterProfileData, "email">;

export type MasterProfileSaveState = {
  status: "idle" | "error" | "success";
  message: string;
};

export const INITIAL_MASTER_PROFILE_SAVE_STATE: MasterProfileSaveState = {
  status: "idle",
  message: "",
};

export type GuestImportRequest = {
  mode: "auto" | "merge";
  draft: unknown;
};

export type GuestImportState = {
  status:
    | "idle"
    | "error"
    | "needs_confirmation"
    | "imported"
    | "already_imported";
  message: string;
  complete: boolean;
  draftHash?: string;
  normalizedUpdatedAt?: string;
  counts?: {
    profileFields: number;
    skills: number;
    entries: number;
    jobs: number;
    skippedEntries: number;
    skippedJobs: number;
  };
};

export const INITIAL_GUEST_IMPORT_STATE: GuestImportState = {
  status: "idle",
  message: "",
  complete: false,
};
