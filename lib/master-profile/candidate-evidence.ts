export const CANDIDATE_LANGUAGE_PROFICIENCIES = [
  "basic",
  "conversational",
  "professional",
  "fluent",
  "native",
] as const;

export type CandidateLanguageProficiency =
  (typeof CANDIDATE_LANGUAGE_PROFICIENCIES)[number];

export type CandidateLanguageEvidence = {
  language: string;
  proficiency?: CandidateLanguageProficiency;
};

export type CandidateEvidence = {
  technologies?: string[];
  softSkills?: string[];
  certifications?: string[];
  languages?: CandidateLanguageEvidence[];
};

export const CANDIDATE_EVIDENCE_LIMITS = {
  technologies: { items: 60, itemLength: 80 },
  softSkills: { items: 60, itemLength: 80 },
  certifications: { items: 40, itemLength: 160 },
  languages: { items: 20, itemLength: 80 },
} as const;

export type CandidateEvidenceParseResult =
  | { status: "absent" }
  | { status: "valid"; evidence: CandidateEvidence }
  | { status: "invalid" };

const CANDIDATE_EVIDENCE_KEYS = new Set([
  "technologies",
  "softSkills",
  "certifications",
  "languages",
]);
const LANGUAGE_KEYS = new Set(["language", "proficiency"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length > maxLength) return null;
  return normalized;
}

function normalizedStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;

  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") return null;
    const normalized = normalizedString(item, maxLength);
    if (normalized === null) return null;
    if (!normalized) continue;

    const key = normalized.toLocaleLowerCase("en-CA");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizedLanguages(value: unknown): CandidateLanguageEvidence[] | null {
  if (
    !Array.isArray(value) ||
    value.length > CANDIDATE_EVIDENCE_LIMITS.languages.items
  ) {
    return null;
  }

  const result: CandidateLanguageEvidence[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return null;
    if (Object.keys(item).some((key) => !LANGUAGE_KEYS.has(key))) return null;
    if (!("language" in item) || typeof item.language !== "string") return null;

    const language = normalizedString(
      item.language,
      CANDIDATE_EVIDENCE_LIMITS.languages.itemLength,
    );
    if (language === null) return null;

    const proficiency = item.proficiency;
    if (
      proficiency !== undefined &&
      (typeof proficiency !== "string" ||
        !CANDIDATE_LANGUAGE_PROFICIENCIES.includes(
          proficiency as CandidateLanguageProficiency,
        ))
    ) {
      return null;
    }

    if (!language) continue;
    const key = language.toLocaleLowerCase("en-CA");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      language,
      ...(proficiency === undefined
        ? {}
        : { proficiency: proficiency as CandidateLanguageProficiency }),
    });
  }

  return result;
}

export function parseCandidateEvidence(
  value: unknown,
): CandidateEvidenceParseResult {
  if (value === undefined) return { status: "absent" };
  if (!isRecord(value)) return { status: "invalid" };
  if (Object.keys(value).some((key) => !CANDIDATE_EVIDENCE_KEYS.has(key))) {
    return { status: "invalid" };
  }

  const evidence: CandidateEvidence = {};
  for (const field of [
    "technologies",
    "softSkills",
    "certifications",
  ] as const) {
    if (!(field in value)) continue;
    const limits = CANDIDATE_EVIDENCE_LIMITS[field];
    const normalized = normalizedStringArray(
      value[field],
      limits.items,
      limits.itemLength,
    );
    if (normalized === null) return { status: "invalid" };
    evidence[field] = normalized;
  }

  if ("languages" in value) {
    const languages = normalizedLanguages(value.languages);
    if (languages === null) return { status: "invalid" };
    evidence.languages = languages;
  }

  return { status: "valid", evidence };
}

export function parseStoredCandidateEvidence(
  masterProfileData: unknown,
): CandidateEvidenceParseResult {
  if (!isRecord(masterProfileData)) return { status: "absent" };
  return parseCandidateEvidence(masterProfileData.candidateEvidence);
}
