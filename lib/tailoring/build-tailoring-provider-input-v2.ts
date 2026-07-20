import {
  buildTailoringProviderInput,
  type BuildTailoringProviderInputResult,
} from "./build-tailoring-provider-input";
import {
  RESUME_SOURCE_SNAPSHOT_CONTRACT_VERSION,
  type ResumeSourceSnapshot,
} from "./resume-source-snapshot";
import {
  immutableTailoringProviderInputV2,
  TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
  TAILORING_V2_UNSUPPORTED_CLAIM_PROHIBITIONS,
  tailoringProviderInputV2Schema,
  type TailoringProviderInputV2,
} from "./tailoring-provider-contracts-v2";
import type { TailoringPreflightPackage } from "./tailoring-preflight";

export type BuildTailoringProviderInputV2Result =
  | Readonly<{ status: "success"; input: TailoringProviderInputV2 }>
  | Exclude<BuildTailoringProviderInputResult, { status: "success" }>
  | Readonly<{ status: "invalid_snapshot" }>;

function evidenceId(category: string, index: number) {
  return `${category}_${String(index + 1).padStart(3, "0")}`;
}

export function buildTailoringProviderInputV2(
  preflight: TailoringPreflightPackage,
  snapshot: ResumeSourceSnapshot,
): BuildTailoringProviderInputV2Result {
  const v1Result = buildTailoringProviderInput(preflight);
  if (v1Result.status !== "success") return v1Result;
  if (
    !snapshot ||
    snapshot.contractVersion !== RESUME_SOURCE_SNAPSHOT_CONTRACT_VERSION
  ) {
    return { status: "invalid_snapshot" };
  }

  try {
    let requirementIndex = 0;
    const nextRequirementId = () =>
      `requirement_${String(++requirementIndex).padStart(3, "0")}`;
    const v1EvidenceById = new Map(
      v1Result.input.approvedCandidateEvidence.map((item) => [
        item.evidenceId,
        item,
      ]),
    );
    const matched = v1Result.input.jobContext.matchedRequirements.map(
      (requirement) => {
        const candidate = v1EvidenceById.get(requirement.evidenceId);
        if (!candidate) throw new Error("missing matched candidate evidence");
        return {
          requirementId: nextRequirementId(),
          category: requirement.category,
          modality: requirement.modality,
          requirement: requirement.requirement,
          candidateTerm: candidate.term,
        };
      },
    );
    const notEvidenced =
      v1Result.input.jobContext.notEvidencedRequirements.map((requirement) => ({
        requirementId: nextRequirementId(),
        category: requirement.category,
        requirement: requirement.requirement,
      }));
    const responsibilities = v1Result.input.jobContext.responsibilities.map(
      (requirement) => ({
        requirementId: nextRequirementId(),
        responsibility: requirement.responsibility,
      }),
    );

    const entries = snapshot.entries.map((entry, entryIndex) => ({
      entryId: `entry_${String(entryIndex + 1).padStart(3, "0")}`,
      section: entry.section,
      heading: entry.heading,
      fragments: entry.fragments.map((fragment, fragmentIndex) => {
        if (fragment.confirmed !== true || fragment.provenance !== "manual") {
          throw new Error("snapshot contains an unapproved fragment");
        }
        return {
          fragmentId: `fragment_${String(entryIndex + 1).padStart(3, "0")}_${String(fragmentIndex + 1).padStart(3, "0")}`,
          text: fragment.text,
          evidenceTags: [...fragment.evidenceTags],
          provenance: "manual" as const,
        };
      }),
    }));

    const evidence: Array<
      TailoringProviderInputV2["evidence"][number]
    > = [];
    snapshot.skills.forEach((term, index) =>
      evidence.push({
        evidenceId: evidenceId("skill", index),
        category: "skill",
        term,
      }),
    );
    (snapshot.candidateEvidence.technologies ?? []).forEach((term, index) =>
      evidence.push({
        evidenceId: evidenceId("technology", index),
        category: "technology",
        term,
      }),
    );
    (snapshot.candidateEvidence.certifications ?? []).forEach((term, index) =>
      evidence.push({
        evidenceId: evidenceId("certification", index),
        category: "certification",
        term,
      }),
    );
    (snapshot.candidateEvidence.languages ?? []).forEach((language, index) =>
      evidence.push({
        evidenceId: evidenceId("language", index),
        category: "language",
        term: language.language,
        ...(language.proficiency
          ? { languageProficiency: language.proficiency }
          : {}),
      }),
    );

    const candidate = {
      contractVersion: TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
      sourceSnapshotContractVersion: snapshot.contractVersion,
      job: structuredClone(v1Result.input.job),
      jobRequirements: {
        matched,
        notEvidenced,
        responsibilities,
        unassessed: {
          total: v1Result.input.jobContext.unassessed.total,
          categories: v1Result.input.jobContext.unassessed.categories.map(
            ({ category, count }) => ({ category, count }),
          ),
        },
        workAuthorization: structuredClone(
          v1Result.input.jobContext.workAuthorization,
        ),
      },
      identity: structuredClone(snapshot.identity),
      education: structuredClone(snapshot.education),
      entries,
      evidence,
      unsupportedClaimProhibitions: [
        ...TAILORING_V2_UNSUPPORTED_CLAIM_PROHIBITIONS,
      ],
    };
    const parsed = tailoringProviderInputV2Schema.safeParse(candidate);
    if (!parsed.success) return { status: "invalid_snapshot" };
    return {
      status: "success",
      input: immutableTailoringProviderInputV2(parsed.data),
    };
  } catch {
    return { status: "invalid_snapshot" };
  }
}
