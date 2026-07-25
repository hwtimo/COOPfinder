export type OwnedResumeVersionSummary = {
  id: string;
  name: string;
  jobTitle: string;
  createdAt: string;
};

export type OwnedResumeVersionSummariesResult =
  | { status: "ready"; versions: OwnedResumeVersionSummary[] }
  | { status: "unavailable"; versions: [] };

type JobRelation = { title: string };

export type ResumeVersionSummaryRow = {
  id: string;
  name: string;
  job_posting_id: string | null;
  created_at: string;
  job: JobRelation | JobRelation[] | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeLabel(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized && normalized.length <= maximum ? normalized : null;
}

function jobTitle(relation: ResumeVersionSummaryRow["job"]): string | null {
  const job = Array.isArray(relation) ? relation[0] : relation;
  return safeLabel(job?.title, 240);
}

export function parseOwnedResumeVersionSummaries(
  rows: ResumeVersionSummaryRow[],
): OwnedResumeVersionSummariesResult {
  const versions: OwnedResumeVersionSummary[] = [];

  for (const row of rows) {
    if (row.job_posting_id === null) continue;

    const name = safeLabel(row.name, 240);
    const linkedJobTitle = jobTitle(row.job);
    if (
      !UUID_PATTERN.test(row.id) ||
      !UUID_PATTERN.test(row.job_posting_id) ||
      !name ||
      name !== row.name ||
      !linkedJobTitle ||
      !Number.isFinite(Date.parse(row.created_at))
    ) {
      return { status: "unavailable", versions: [] };
    }

    versions.push({
      id: row.id,
      name,
      jobTitle: linkedJobTitle,
      createdAt: row.created_at,
    });
  }

  return { status: "ready", versions };
}
