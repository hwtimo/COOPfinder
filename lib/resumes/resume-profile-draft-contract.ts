import { z } from "zod";

import type { MasterProfileSection } from "@/lib/master-profile/types";

export const RESUME_PROFILE_DRAFT_CONTRACT_VERSION =
  "resume-profile-draft-v1" as const;

const draftTextSchema = z.string().min(1).max(4_000);
const draftSkillSchema = z.string().min(1).max(100);

export const resumeProfileDraftEntryOutputSchema = z
  .object({
    text: draftTextSchema,
    skills: z.array(draftSkillSchema).max(30),
  })
  .strict();

export const resumeProfileDraftOutputV1Schema = z
  .object({
    contractVersion: z.literal(RESUME_PROFILE_DRAFT_CONTRACT_VERSION),
    education: z.array(resumeProfileDraftEntryOutputSchema).max(20),
    skills: z.array(draftSkillSchema).max(100),
    workExperience: z.array(resumeProfileDraftEntryOutputSchema).max(30),
    projects: z.array(resumeProfileDraftEntryOutputSchema).max(30),
    leadershipActivities: z
      .array(resumeProfileDraftEntryOutputSchema)
      .max(30),
  })
  .strict();

export type ResumeProfileDraftOutputV1 = z.infer<
  typeof resumeProfileDraftOutputV1Schema
>;

export type ResumeProfileDraftEntry = Readonly<{
  temporaryId: string;
  section: MasterProfileSection;
  source: "Resume upload draft";
  text: string;
  skills: readonly string[];
  confirmed: false;
  sortOrder: number;
}>;

export type ResumeProfileDraftV1 = Readonly<{
  contractVersion: typeof RESUME_PROFILE_DRAFT_CONTRACT_VERSION;
  skills: readonly string[];
  education: readonly ResumeProfileDraftEntry[];
  workExperience: readonly ResumeProfileDraftEntry[];
  projects: readonly ResumeProfileDraftEntry[];
  leadershipActivities: readonly ResumeProfileDraftEntry[];
}>;
