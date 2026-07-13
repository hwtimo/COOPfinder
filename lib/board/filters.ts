import type { PublicBoardJob } from "./types";

export const BOARD_ROLE_FILTERS = [
  { value: "software", label: "Software" },
  { value: "embedded", label: "Embedded systems" },
  { value: "data", label: "Data and analytics" },
  { value: "cloud", label: "Cloud and platform" },
  { value: "full-stack", label: "Full-stack" },
  { value: "qa", label: "QA and automation" },
] as const;

export const BOARD_LOCATION_FILTERS = [
  { value: "vancouver", label: "Vancouver" },
  { value: "burnaby", label: "Burnaby" },
  { value: "toronto", label: "Toronto" },
  { value: "waterloo", label: "Waterloo" },
  { value: "remote", label: "Remote, Canada" },
] as const;

export const BOARD_WORK_MODE_FILTERS = ["Remote", "Hybrid", "On-site"] as const;

export const BOARD_TERM_FILTERS = [
  { value: "fall-2026", label: "Fall 2026" },
  { value: "winter-2027", label: "Winter 2027" },
  { value: "summer-2027", label: "Summer 2027" },
] as const;

export type BoardFilters = {
  role?: (typeof BOARD_ROLE_FILTERS)[number]["value"];
  location?: (typeof BOARD_LOCATION_FILTERS)[number]["value"];
  workMode?: (typeof BOARD_WORK_MODE_FILTERS)[number];
  term?: (typeof BOARD_TERM_FILTERS)[number]["value"];
};

type BoardSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function allowedValue<const Values extends readonly string[]>(
  value: string | undefined,
  values: Values,
): Values[number] | undefined {
  return value && values.includes(value as Values[number])
    ? (value as Values[number])
    : undefined;
}

export function parseBoardFilters(params: BoardSearchParams): BoardFilters {
  return {
    role: allowedValue(
      first(params.role),
      BOARD_ROLE_FILTERS.map((option) => option.value),
    ),
    location: allowedValue(
      first(params.location),
      BOARD_LOCATION_FILTERS.map((option) => option.value),
    ),
    workMode: allowedValue(first(params.workMode), BOARD_WORK_MODE_FILTERS),
    term: allowedValue(
      first(params.term),
      BOARD_TERM_FILTERS.map((option) => option.value),
    ),
  };
}

function matchesRole(job: PublicBoardJob, role: NonNullable<BoardFilters["role"]>) {
  const text = `${job.title} ${job.keywords.join(" ")}`.toLocaleLowerCase();

  const roleTerms: Record<NonNullable<BoardFilters["role"]>, string[]> = {
    software: ["software", "developer", "frontend", "backend", "engineering"],
    embedded: ["embedded", "systems", "rtos", "hardware"],
    data: ["data", "analyst", "analytics", "dashboard"],
    cloud: ["cloud", "platform", "infrastructure", "devtools"],
    "full-stack": ["full stack", "full-stack"],
    qa: ["qa", "quality", "test", "testing", "automation"],
  };

  return roleTerms[role].some((term) => text.includes(term));
}

export function filterBoardJobs(
  jobs: PublicBoardJob[],
  filters: BoardFilters,
): PublicBoardJob[] {
  return jobs.filter((job) => {
    if (filters.role && !matchesRole(job, filters.role)) return false;
    if (
      filters.location &&
      !job.location?.toLocaleLowerCase().includes(filters.location)
    ) {
      return false;
    }
    if (filters.workMode && job.workMode !== filters.workMode) return false;
    if (
      filters.term &&
      !job.term
        ?.toLocaleLowerCase()
        .replace(/\s+/g, "-")
        .includes(filters.term)
    ) {
      return false;
    }
    return true;
  });
}

export function hasBoardFilters(filters: BoardFilters): boolean {
  return Object.values(filters).some(Boolean);
}
