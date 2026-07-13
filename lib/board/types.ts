export type BoardWorkMode = "Remote" | "Hybrid" | "On-site";

export type PublicBoardJob = {
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  workMode: BoardWorkMode | null;
  term: string | null;
  deadline: string | null;
  workAuthorization: string | null;
  summary: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  keywords: string[];
  sourceUrl: string;
  lastCheckedAt: string | null;
  status: "approved";
  isActive: true;
};

export type BoardDataSource = "supabase" | "fixture";

export type BoardQueryResult<T> =
  | { status: "ready"; source: BoardDataSource; data: T }
  | { status: "error"; data: T };
