import {
  jobExtractionWireV1Schema,
  type JobExtractionWireV1,
} from "./schemas/job-extraction-wire";

type WireField<T> = Readonly<{
  value: T | null;
  confidence: number;
}>;

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizedKey(value: string) {
  return collapseWhitespace(value).toLocaleLowerCase("en-CA");
}

function normalizeStrings(values: readonly string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = collapseWhitespace(value);
    if (!trimmed) continue;

    const key = normalizedKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function normalizeTextField(field: WireField<string>) {
  if (field.value === null) return field;

  const value = collapseWhitespace(field.value);
  return value
    ? { value, confidence: field.confidence }
    : { value: null, confidence: 0 };
}

function normalizeArrayField(field: WireField<string[]>) {
  return field.value === null
    ? field
    : { value: normalizeStrings(field.value), confidence: field.confidence };
}

function isCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeDeadline(field: WireField<string>) {
  return field.value !== null && isCalendarDate(field.value)
    ? field
    : { value: null, confidence: 0 };
}

export function normalizeJobExtractionWireOutput(
  value: unknown,
): JobExtractionWireV1 | null {
  const parsed = jobExtractionWireV1Schema.safeParse(value);
  if (!parsed.success) return null;

  const output = parsed.data;
  return {
    ...output,
    companyName: normalizeTextField(output.companyName),
    title: normalizeTextField(output.title),
    location: normalizeTextField(output.location),
    term: normalizeTextField(output.term),
    deadline: normalizeDeadline(output.deadline),
    namedSkills: normalizeArrayField(output.namedSkills),
    responsibilities: normalizeArrayField(output.responsibilities),
    requirements: normalizeArrayField(output.requirements),
    structuredRequirements: {
      requiredSkills: normalizeStrings(output.structuredRequirements.requiredSkills),
      preferredSkills: normalizeStrings(output.structuredRequirements.preferredSkills),
      requiredTechnologies: normalizeStrings(
        output.structuredRequirements.requiredTechnologies,
      ),
      preferredTechnologies: normalizeStrings(
        output.structuredRequirements.preferredTechnologies,
      ),
      education: normalizeStrings(output.structuredRequirements.education),
      certifications: normalizeStrings(
        output.structuredRequirements.certifications,
      ),
      languages: normalizeStrings(output.structuredRequirements.languages),
      workAuthorization: normalizeStrings(
        output.structuredRequirements.workAuthorization,
      ),
      experience: normalizeStrings(output.structuredRequirements.experience),
      responsibilities: normalizeStrings(
        output.structuredRequirements.responsibilities,
      ),
      softSkills: normalizeStrings(output.structuredRequirements.softSkills),
      keywords: normalizeStrings(output.structuredRequirements.keywords),
      uncategorizedRequirements: normalizeStrings(
        output.structuredRequirements.uncategorizedRequirements,
      ),
    },
  };
}
