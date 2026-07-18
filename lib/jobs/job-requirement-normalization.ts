export const CANONICAL_JOB_REQUIREMENTS_VERSION =
  "job-requirements-v1" as const;

export type CanonicalJobRequirements = Readonly<{
  contractVersion: typeof CANONICAL_JOB_REQUIREMENTS_VERSION;
  requiredSkills: readonly string[];
  preferredSkills: readonly string[];
  requiredTechnologies: readonly string[];
  preferredTechnologies: readonly string[];
  education: readonly string[];
  certifications: readonly string[];
  languages: readonly string[];
  workAuthorization: readonly string[];
  experience: readonly string[];
  responsibilities: readonly string[];
  softSkills: readonly string[];
  keywords: readonly string[];
  uncategorizedRequirements: readonly string[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedDuplicateKey(value: string) {
  return value.toLocaleLowerCase("en-CA");
}

function normalizeStringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") continue;

    const candidate = normalizeWhitespace(item);
    if (!candidate) continue;

    const duplicateKey = normalizedDuplicateKey(candidate);
    if (seen.has(duplicateKey)) continue;

    seen.add(duplicateKey);
    normalized.push(candidate);
  }

  return normalized;
}

function extractedList(extraction: unknown, fieldName: string) {
  if (!isRecord(extraction)) return [];

  const field = extraction[fieldName];
  if (!isRecord(field)) return [];

  return normalizeStringList(field.value);
}

export function normalizeJobRequirements(
  persistedExtraction: unknown,
): CanonicalJobRequirements {
  return {
    contractVersion: CANONICAL_JOB_REQUIREMENTS_VERSION,
    requiredSkills: [],
    preferredSkills: [],
    requiredTechnologies: [],
    preferredTechnologies: [],
    education: [],
    certifications: [],
    languages: [],
    workAuthorization: [],
    experience: [],
    responsibilities: extractedList(
      persistedExtraction,
      "responsibilities",
    ),
    softSkills: [],
    keywords: extractedList(persistedExtraction, "namedSkills"),
    uncategorizedRequirements: extractedList(
      persistedExtraction,
      "requirements",
    ),
  };
}
