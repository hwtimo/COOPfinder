export type ApplicationStatus =
  | "saved"
  | "tailoring"
  | "ready"
  | "applied"
  | "oa"
  | "interview"
  | "offer"
  | "rejected";

export type ApplicationTrackerStatus = Exclude<ApplicationStatus, "oa">;

export type JobRoleType =
  | "Software"
  | "Embedded"
  | "Data"
  | "Cloud"
  | "Full stack"
  | "Network";

export type WorkMode = "Hybrid" | "Remote" | "On-site";

export type WorkAuthorization =
  | "Canadian work authorization"
  | "Domestic students"
  | "International eligible";

export interface MockCompany {
  id: string;
  name: string;
  location: string;
  industry: string;
  hiringNotes: string;
}

export interface MockJob {
  id: string;
  company: string;
  role: string;
  location: string;
  roleType: JobRoleType;
  workMode: WorkMode;
  term: string;
  deadline: string; // ISO date
  match: number | null; // 0-100 estimated match, null = not analyzed
  status: ApplicationStatus;
  resumeVersion: string | null;
  coopEligible: boolean;
  workAuthorization: WorkAuthorization;
  sourceUrl: string;
  description: string;
  notes: string;
  savedAt: string;
  updatedAt: string;
  nextAction: string;
}

export interface MockJobAnalysis {
  aiSummary: string;
  responsibilities: string[];
  requirements: string[];
  keywords: string[];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  missingKeywords: string[];
  workAuthorizationNotes: string;
  coopTermFit: string;
  resumeSuggestions: string[];
  suggestedResumeVersion: string;
}

export interface MockJobRequirement {
  jobId: string;
  mustHave: string[];
  niceToHave: string[];
  keywords: string[];
  missingKeywords: string[];
}

export interface MockApplicationColumn {
  id: ApplicationTrackerStatus;
  label: string;
  helper: string;
}

export interface MockApplication {
  id: string;
  jobId: string;
  status: ApplicationTrackerStatus;
  lastAction: string;
  nextAction: string;
  followUpDue?: string;
}

export interface MockApplicationTimelineItem {
  id: string;
  applicationId: string;
  label: string;
  detail: string;
  date: string;
}

export interface MockMetric {
  label: string;
  value: number;
  helper: string;
  tone?: "default" | "warning";
  actionLabel: string;
  href: string;
}

export interface MockPipelineStage {
  id: ApplicationTrackerStatus;
  label: string;
  count: number;
  helper: string;
  action: string;
  href: string;
}

export interface MockNextAction {
  id: string;
  title: string;
  detail: string;
  action: string;
  href: string;
}

export interface MockStudentProfile {
  name: string;
  initials: string;
  email: string;
  phone: string;
  location: string;
  school: string;
  program: string;
  year: string;
  term: string;
  workAuthorization: WorkAuthorization;
  targetRoles: JobRoleType[];
}

export interface MockResumeBullet {
  id: string;
  section: "education" | "experience" | "project" | "skills";
  source: string;
  text: string;
  skills: string[];
  impact?: string;
}

export interface MockMasterResume {
  id: string;
  title: string;
  updatedAt: string;
  summary: string;
  education: string[];
  bullets: MockResumeBullet[];
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
    other: string[];
  };
}

export interface MockResumeVersion {
  id: string;
  name: string;
  focus: JobRoleType;
  updatedAt: string;
  usedFor: string[];
  callbackEstimate: string;
  notes: string;
}

export interface MockAISuggestion {
  id: string;
  jobId: string;
  resumeBulletId: string;
  label: string;
  before: string;
  after: string;
  rationale: string;
  trustLabel: "Suggested by AI" | "Based on your existing resume" | "Needs confirmation";
  status: "pending" | "accepted" | "rejected";
  keywords: string[];
}

export interface MockKeywordChecklistItem {
  id: string;
  jobId: string;
  keyword: string;
  status: "covered" | "missing" | "review";
  source: string;
}

/* ---------- Resume Tailoring Workspace ---------- */

export type TailoringTrustLabel =
  | "Based on your existing resume"
  | "Suggested by AI"
  | "Needs confirmation"
  | "Potential unsupported claim";

export interface MockTailoringSuggestion {
  id: string;
  /** Which draft bullet this suggestion replaces. */
  bulletId: string;
  /** Human-readable source in the master resume, e.g. "Course planning web app (Project)". */
  sourceExperience: string;
  /** Master-resume bullet id backing this suggestion (audit trail). */
  sourceBulletId: string | null;
  before: string;
  after: string;
  rationale: string;
  trustLabel: TailoringTrustLabel;
  /** Present only for uncertain / unsupported suggestions. */
  warning?: string;
  addedKeywords: string[];
}

export interface MockTailoringBullet {
  id: string;
  text: string;
  /** When set, this bullet has a pending AI suggestion. */
  suggestionId?: string;
}

export interface MockTailoringEntry {
  id: string;
  title: string;
  subtitle?: string;
  bullets: MockTailoringBullet[];
}

export interface MockTailoringSection {
  id: string;
  heading: string;
  entries: MockTailoringEntry[];
}

export interface MockTailoringKeyword {
  id: string;
  keyword: string;
  /** Status before any suggestion is accepted. */
  baseStatus: "covered" | "review" | "missing";
  /** Where coverage comes from (resume source or "No supported source yet"). */
  source: string;
  /** Accepting any of these suggestions marks the keyword covered. */
  coveredBySuggestionIds?: string[];
}

export interface MockTailoringSession {
  id: string;
  jobId: string;
  versionName: string;
  baseVersionName: string;
  createdAt: string;
  sections: MockTailoringSection[];
  suggestions: MockTailoringSuggestion[];
  keywords: MockTailoringKeyword[];
}
