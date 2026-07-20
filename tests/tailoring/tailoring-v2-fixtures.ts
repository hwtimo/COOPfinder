import {
  RESUME_SOURCE_SNAPSHOT_CONTRACT_VERSION,
  type ResumeSourceSnapshot,
} from "../../lib/tailoring/resume-source-snapshot";
import {
  TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
  TAILORING_V2_PLAN_SECTION_TYPES,
} from "../../lib/tailoring/tailoring-provider-contracts-v2";
import {
  TAILORING_PREFLIGHT_CONTRACT_VERSION,
  TAILORING_SAFETY_PROHIBITIONS,
  type TailoringPreflightPackage,
} from "../../lib/tailoring/tailoring-preflight";

export function readyPreflightV2(): TailoringPreflightPackage {
  return {
    contractVersion: TAILORING_PREFLIGHT_CONTRACT_VERSION,
    readiness: "ready",
    job: {
      id: "00000000-0000-4000-8000-000000000099",
      title: "Product Developer",
      companyName: "Example Company",
      location: "Vancouver, BC",
    },
    matched: {
      requiredSkills: [
        { requirement: "TypeScript", matchedCandidateTerm: "TypeScript" },
      ],
      preferredSkills: [],
      requiredTechnologies: [
        { requirement: "React", matchedCandidateTerm: "React" },
      ],
      preferredTechnologies: [],
      softSkills: [],
      certifications: [
        {
          requirement: "AWS Certified Cloud Practitioner",
          matchedCandidateTerm: "AWS Certified Cloud Practitioner",
        },
      ],
      languages: [
        { requirement: "French", matchedCandidateTerm: "French" },
      ],
      keywords: [],
    },
    workAuthorization: {
      status: "no_job_requirement",
      jobRequirements: [],
      candidateValue: "Canadian work authorization",
    },
    supportingEvidence: [
      {
        sourceType: "top_level_general_skill",
        displayTitle: "General skills",
        matchedTerms: ["TypeScript"],
      },
      {
        sourceType: "explicit_technology",
        displayTitle: "Technologies",
        matchedTerms: ["React"],
      },
      {
        sourceType: "explicit_certification",
        displayTitle: "Certifications",
        matchedTerms: ["AWS Certified Cloud Practitioner"],
      },
      {
        sourceType: "explicit_language",
        displayTitle: "Languages",
        matchedTerms: ["French"],
        languageProficiency: "professional",
      },
    ],
    jobContext: { responsibilities: ["Build reliable interfaces"] },
    notEvidenced: [
      { category: "preferred_technology", requirement: "Kubernetes" },
    ],
    unassessed: { total: 1, categories: [{ category: "education", count: 1 }] },
    safetyProhibitions: TAILORING_SAFETY_PROHIBITIONS,
  };
}

export function resumeSourceSnapshotV2(): ResumeSourceSnapshot {
  return {
    contractVersion: RESUME_SOURCE_SNAPSHOT_CONTRACT_VERSION,
    identity: { fullName: "Avery Chen", email: "avery@example.invalid" },
    education: {
      school: "SFU",
      program: "Computing Science",
      gradYear: "2027",
      coopTerm: "Fall 2026",
    },
    skills: ["TypeScript", "Accessibility"],
    candidateEvidence: {
      technologies: ["React", "PostgreSQL"],
      softSkills: ["Communication"],
      certifications: ["AWS Certified Cloud Practitioner"],
      languages: [{ language: "French", proficiency: "professional" }],
    },
    entries: [
      {
        section: "experience",
        heading: "Frontend Developer",
        fragments: [
          {
            fragmentId: "11111111-1111-4111-8111-111111111111",
            text: "Improved latency by 37% in 2025.",
            evidenceTags: ["React", "Performance"],
            confirmed: true,
            order: 0,
            provenance: "manual",
          },
          {
            fragmentId: "22222222-2222-4222-8222-222222222222",
            text: "Built keyboard-accessible navigation.",
            evidenceTags: ["Accessibility"],
            confirmed: true,
            order: 1,
            provenance: "manual",
          },
        ],
      },
      {
        section: "project",
        heading: "Unselected Project",
        fragments: [
          {
            fragmentId: "33333333-3333-4333-8333-333333333333",
            text: "This approved but unselected fragment must stay out.",
            evidenceTags: ["PostgreSQL"],
            confirmed: true,
            order: 0,
            provenance: "manual",
          },
        ],
      },
    ],
  };
}

type MutableTailoringPlanV2 = {
  contractVersion: typeof TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION;
  sections: Array<{
    type: (typeof TAILORING_V2_PLAN_SECTION_TYPES)[number];
    entries: Array<{ entryId: string; fragmentIds: string[] }>;
    evidenceIds: string[];
  }>;
};

export function validTailoringPlanV2(): MutableTailoringPlanV2 {
  return {
    contractVersion: TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
    sections: [
      { type: "education", entries: [], evidenceIds: [] },
      {
        type: "experience",
        entries: [
          {
            entryId: "entry_001",
            fragmentIds: ["fragment_001_002", "fragment_001_001"],
          },
        ],
        evidenceIds: [],
      },
      { type: "skills", entries: [], evidenceIds: ["skill_001"] },
      {
        type: "technologies",
        entries: [],
        evidenceIds: ["technology_001"],
      },
      {
        type: "certifications",
        entries: [],
        evidenceIds: ["certification_001"],
      },
      { type: "languages", entries: [], evidenceIds: ["language_001"] },
    ],
  };
}
