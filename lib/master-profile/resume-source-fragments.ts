export const RESUME_SOURCE_FRAGMENT_LIMITS = {
  fragmentsPerEntry: 20,
  textLength: 500,
  evidenceTagsPerFragment: 20,
  evidenceTagLength: 80,
} as const;

export const RESUME_SOURCE_FRAGMENT_PROVENANCES = ["manual"] as const;

export type ResumeSourceFragmentProvenance =
  (typeof RESUME_SOURCE_FRAGMENT_PROVENANCES)[number];

export type ResumeSourceFragmentRecord = {
  fragmentId: string;
  text: string;
  evidenceTags: string[];
  confirmed: boolean;
  order: number;
  provenance: ResumeSourceFragmentProvenance;
};

export type ApprovedResumeSourceFragment = Omit<
  ResumeSourceFragmentRecord,
  "confirmed"
> & { confirmed: true };

export type ResumeSourceFragmentsParseResult =
  | { status: "absent" }
  | { status: "valid"; fragments: ResumeSourceFragmentRecord[] }
  | { status: "invalid" };

const FRAGMENT_KEYS = new Set([
  "fragmentId",
  "text",
  "evidenceTags",
  "confirmed",
  "order",
  "provenance",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

function normalizeEvidenceTags(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length > RESUME_SOURCE_FRAGMENT_LIMITS.evidenceTagsPerFragment
  ) {
    return null;
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") return null;
    const normalized = item.replace(/\s+/g, " ").trim();
    if (normalized.length > RESUME_SOURCE_FRAGMENT_LIMITS.evidenceTagLength) {
      return null;
    }
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("en-CA");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function parseResumeSourceFragments(
  value: unknown,
): ResumeSourceFragmentsParseResult {
  if (value === undefined) return { status: "absent" };
  if (
    !Array.isArray(value) ||
    value.length > RESUME_SOURCE_FRAGMENT_LIMITS.fragmentsPerEntry
  ) {
    return { status: "invalid" };
  }

  const fragments: ResumeSourceFragmentRecord[] = [];
  const fragmentIds = new Set<string>();
  const orders = new Set<number>();

  for (const item of value) {
    if (!isRecord(item)) return { status: "invalid" };
    if (
      Object.keys(item).some((key) => !FRAGMENT_KEYS.has(key)) ||
      Object.keys(item).length !== FRAGMENT_KEYS.size
    ) {
      return { status: "invalid" };
    }

    const fragmentId = item.fragmentId;
    const text = normalizeText(
      item.text,
      RESUME_SOURCE_FRAGMENT_LIMITS.textLength,
    );
    const evidenceTags = normalizeEvidenceTags(item.evidenceTags);
    const order = item.order;
    if (
      typeof fragmentId !== "string" ||
      !UUID_PATTERN.test(fragmentId) ||
      text === null ||
      evidenceTags === null ||
      typeof item.confirmed !== "boolean" ||
      typeof order !== "number" ||
      !Number.isInteger(order) ||
      order < 0 ||
      order >= RESUME_SOURCE_FRAGMENT_LIMITS.fragmentsPerEntry ||
      item.provenance !== "manual"
    ) {
      return { status: "invalid" };
    }

    const idKey = fragmentId.toLocaleLowerCase("en-CA");
    if (fragmentIds.has(idKey) || orders.has(order)) {
      return { status: "invalid" };
    }
    fragmentIds.add(idKey);
    orders.add(order);
    fragments.push({
      fragmentId,
      text,
      evidenceTags,
      confirmed: item.confirmed,
      order,
      provenance: "manual",
    });
  }

  fragments.sort((left, right) => left.order - right.order);
  return { status: "valid", fragments };
}

export function approvedResumeSourceFragments(
  value: unknown,
): ApprovedResumeSourceFragment[] {
  const parsed = parseResumeSourceFragments(value);
  if (parsed.status !== "valid") return [];
  return parsed.fragments.filter(
    (fragment): fragment is ApprovedResumeSourceFragment => fragment.confirmed,
  );
}
