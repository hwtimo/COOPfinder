import {
  parseCandidateEvidence,
  type CandidateEvidence,
} from "@/lib/master-profile/candidate-evidence";
import {
  approvedResumeSourceFragments,
  parseResumeSourceFragments,
  type ApprovedResumeSourceFragment,
} from "@/lib/master-profile/resume-source-fragments";
import {
  MASTER_PROFILE_SECTIONS,
  type MasterProfileData,
  type MasterProfileSection,
} from "@/lib/master-profile/types";

export const RESUME_SOURCE_SNAPSHOT_CONTRACT_VERSION =
  "resume-source-snapshot-v1" as const;

export type ResumeSourceSnapshotEntry = Readonly<{
  section: MasterProfileSection;
  heading: string;
  fragments: readonly Readonly<ApprovedResumeSourceFragment>[];
}>;

export type ResumeSourceSnapshot = Readonly<{
  contractVersion: typeof RESUME_SOURCE_SNAPSHOT_CONTRACT_VERSION;
  identity: Readonly<{ fullName: string; email: string }>;
  education: Readonly<{
    school: string;
    program: string;
    gradYear: string;
    coopTerm: string;
  }>;
  skills: readonly string[];
  candidateEvidence: Readonly<CandidateEvidence>;
  entries: readonly ResumeSourceSnapshotEntry[];
}>;

export type BuildResumeSourceSnapshotResult =
  | Readonly<{ status: "ready"; snapshot: ResumeSourceSnapshot }>
  | Readonly<{ status: "invalid_profile" }>;

function normalizedString(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maximum ? normalized : null;
}

function normalizedUniqueStrings(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = normalizedString(item, maximumLength);
    if (normalized === null) return null;
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("en-CA");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function buildResumeSourceSnapshot(
  profileValue: MasterProfileData,
): BuildResumeSourceSnapshotResult {
  const profile = profileValue as unknown as Record<string, unknown>;
  const fullName = normalizedString(profile.fullName, 160);
  const email = normalizedString(profile.email, 320);
  const school = normalizedString(profile.school, 40);
  const program = normalizedString(profile.program, 120);
  const gradYear = normalizedString(profile.gradYear, 4);
  const coopTerm = normalizedString(profile.coopTerm, 80);
  const skills = normalizedUniqueStrings(profile.skills, 60, 80);
  const candidateEvidence = parseCandidateEvidence(profile.candidateEvidence);
  const entriesValue = profile.entries;
  if (
    fullName === null ||
    email === null ||
    school === null ||
    program === null ||
    gradYear === null ||
    coopTerm === null ||
    skills === null ||
    candidateEvidence.status === "invalid" ||
    !Array.isArray(entriesValue) ||
    entriesValue.length > 100
  ) {
    return { status: "invalid_profile" };
  }

  const entries: Array<ResumeSourceSnapshotEntry & { sortOrder: number }> = [];
  for (const [index, entryValue] of entriesValue.entries()) {
    if (
      typeof entryValue !== "object" ||
      entryValue === null ||
      Array.isArray(entryValue)
    ) {
      return { status: "invalid_profile" };
    }
    const entry = entryValue as Record<string, unknown>;
    const parsedFragments = parseResumeSourceFragments(entry.resumeFragments);
    if (parsedFragments.status === "invalid") {
      return { status: "invalid_profile" };
    }
    if (entry.confirmed !== true || parsedFragments.status !== "valid") continue;

    const heading = normalizedString(entry.source, 160);
    const section = entry.section;
    const sortOrder = entry.sortOrder;
    if (
      !heading ||
      typeof section !== "string" ||
      !MASTER_PROFILE_SECTIONS.includes(section as MasterProfileSection) ||
      typeof sortOrder !== "number" ||
      !Number.isFinite(sortOrder)
    ) {
      return { status: "invalid_profile" };
    }
    const fragments = approvedResumeSourceFragments(entry.resumeFragments);
    if (fragments.length === 0) continue;
    entries.push({
      section: section as MasterProfileSection,
      heading,
      fragments: fragments.map((fragment) => ({
        fragmentId: fragment.fragmentId,
        text: fragment.text,
        evidenceTags: [...fragment.evidenceTags],
        confirmed: true,
        order: fragment.order,
        provenance: fragment.provenance,
      })),
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : index,
    });
  }

  entries.sort((left, right) => left.sortOrder - right.sortOrder);
  return {
    status: "ready",
    snapshot: {
      contractVersion: RESUME_SOURCE_SNAPSHOT_CONTRACT_VERSION,
      identity: { fullName, email },
      education: { school, program, gradYear, coopTerm },
      skills,
      candidateEvidence:
        candidateEvidence.status === "valid"
          ? structuredClone(candidateEvidence.evidence)
          : {},
      entries: entries.map((entry) => ({
        section: entry.section,
        heading: entry.heading,
        fragments: entry.fragments,
      })),
    },
  };
}
