import "server-only";

import type { MasterProfileSection } from "@/lib/master-profile/types";

import { openAIResumeProfileDraftProvider } from "./openai-resume-profile-draft-provider";
import {
  RESUME_PROFILE_DRAFT_CONTRACT_VERSION,
  resumeProfileDraftOutputV1Schema,
  type ResumeProfileDraftEntry,
  type ResumeProfileDraftOutputV1,
  type ResumeProfileDraftV1,
} from "./resume-profile-draft-contract";
import type { ResumeProfileDraftProvider } from "./resume-profile-draft-provider";

export const MAX_RESUME_PROFILE_DRAFT_INPUT_CHARACTERS = 30_000;

export type GenerateResumeProfileDraftResult =
  | { status: "success"; draft: ResumeProfileDraftV1 }
  | {
      status: "invalid_input";
      reason: "empty_text" | "text_too_long";
    }
  | {
      status: "configuration_unavailable";
      reason:
        | "live_provider_disabled"
        | "model_not_configured"
        | "api_key_not_configured";
    }
  | {
      status: "provider_unavailable" | "provider_refusal" | "invalid_output";
    };

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function evidenceKey(value: string): string {
  return collapseWhitespace(value).toLocaleLowerCase("en-CA");
}

function normalizeSupportedText(
  value: string,
  resumeEvidence: string,
): string | null {
  const normalized = collapseWhitespace(value);
  if (!normalized || !resumeEvidence.includes(evidenceKey(normalized))) {
    return null;
  }
  return normalized;
}

function normalizeSkills(
  values: readonly string[],
  resumeEvidence: string,
): string[] | null {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeSupportedText(value, resumeEvidence);
    if (normalized === null) return null;
    const key = evidenceKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function buildEntries(
  values: ResumeProfileDraftOutputV1["education"],
  category: string,
  section: MasterProfileSection,
  resumeEvidence: string,
): ResumeProfileDraftEntry[] | null {
  const output: ResumeProfileDraftEntry[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const text = normalizeSupportedText(value.text, resumeEvidence);
    const skills = normalizeSkills(value.skills, resumeEvidence);
    if (text === null || skills === null) return null;
    const key = evidenceKey(text);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      temporaryId: `resume-draft-${category}-${output.length + 1}`,
      section,
      source: "Resume upload draft",
      text,
      skills,
      confirmed: false,
      sortOrder: output.length,
    });
  }
  return output;
}

export function buildSupportedResumeProfileDraft(
  output: unknown,
  extractedResumeText: string,
): ResumeProfileDraftV1 | null {
  const parsed = resumeProfileDraftOutputV1Schema.safeParse(output);
  if (!parsed.success) return null;

  const resumeEvidence = evidenceKey(extractedResumeText);
  const skills = normalizeSkills(parsed.data.skills, resumeEvidence);
  const education = buildEntries(
    parsed.data.education,
    "education",
    "education",
    resumeEvidence,
  );
  const workExperience = buildEntries(
    parsed.data.workExperience,
    "experience",
    "experience",
    resumeEvidence,
  );
  const projects = buildEntries(
    parsed.data.projects,
    "project",
    "project",
    resumeEvidence,
  );
  const leadershipActivities = buildEntries(
    parsed.data.leadershipActivities,
    "leadership",
    "volunteer",
    resumeEvidence,
  );

  if (
    skills === null ||
    education === null ||
    workExperience === null ||
    projects === null ||
    leadershipActivities === null
  ) {
    return null;
  }

  return {
    contractVersion: RESUME_PROFILE_DRAFT_CONTRACT_VERSION,
    skills,
    education,
    workExperience,
    projects,
    leadershipActivities,
  };
}

export async function generateResumeProfileDraft(
  input: unknown,
  provider: ResumeProfileDraftProvider = openAIResumeProfileDraftProvider,
): Promise<GenerateResumeProfileDraftResult> {
  if (typeof input !== "string" || !input.trim()) {
    return { status: "invalid_input", reason: "empty_text" };
  }
  const extractedResumeText = input.trim();
  if (extractedResumeText.length > MAX_RESUME_PROFILE_DRAFT_INPUT_CHARACTERS) {
    return { status: "invalid_input", reason: "text_too_long" };
  }

  let result;
  try {
    result = await provider.generateDraft(extractedResumeText);
  } catch {
    return { status: "provider_unavailable" };
  }
  if (result.status === "configuration_unavailable") return result;
  if (result.status === "refusal") return { status: "provider_refusal" };
  if (result.status === "unavailable") {
    return { status: "provider_unavailable" };
  }
  if (result.status === "invalid_output") return { status: "invalid_output" };

  const draft = buildSupportedResumeProfileDraft(
    result.output,
    extractedResumeText,
  );
  return draft ? { status: "success", draft } : { status: "invalid_output" };
}
