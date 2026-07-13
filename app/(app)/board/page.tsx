import Link from "next/link";
import { AlertTriangle, BriefcaseBusiness, SlidersHorizontal } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PublicJobCard } from "@/components/board/public-job-card";
import { Button } from "@/components/ui/button";
import {
  BOARD_LOCATION_FILTERS,
  BOARD_ROLE_FILTERS,
  BOARD_TERM_FILTERS,
  BOARD_WORK_MODE_FILTERS,
  filterBoardJobs,
  hasBoardFilters,
  parseBoardFilters,
} from "@/lib/board/filters";
import { getPublicBoardJobs } from "@/lib/board/queries";

export const dynamic = "force-dynamic";

type BoardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const filterClassName =
  "h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 sm:w-auto sm:min-w-36";

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const [result, params] = await Promise.all([
    getPublicBoardJobs(),
    searchParams,
  ]);
  const filters = parseBoardFilters(params);
  const jobs = result.status === "ready" ? filterBoardJobs(result.data, filters) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Job board"
        description="Co-op roles curated and community-submitted, reviewed before posting. Open the original source to verify details."
        actions={
          <>
            <Button asChild variant="outline" className="h-9 rounded-md">
              <Link href="/board/submit">Submit a role</Link>
            </Button>
            <Button asChild className="h-9 rounded-md">
              <Link href="/start">Start your profile</Link>
            </Button>
          </>
        }
      />

      {result.status === "ready" && result.source === "fixture" ? (
        <div className="rounded-md border border-info/20 bg-info-soft px-3 py-2 text-xs leading-5 text-foreground">
          Supabase is not configured for this local build. Showing the isolated,
          public-safe starter set used by onboarding.
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Filter curated roles</h2>
        </div>
        <form action="/board" method="get" className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Role
            <select name="role" defaultValue={filters.role ?? ""} className={filterClassName}>
              <option value="">All roles</option>
              {BOARD_ROLE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Location
            <select name="location" defaultValue={filters.location ?? ""} className={filterClassName}>
              <option value="">All locations</option>
              {BOARD_LOCATION_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Work mode
            <select name="workMode" defaultValue={filters.workMode ?? ""} className={filterClassName}>
              <option value="">All modes</option>
              {BOARD_WORK_MODE_FILTERS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Term
            <select name="term" defaultValue={filters.term ?? ""} className={filterClassName}>
              <option value="">All terms</option>
              {BOARD_TERM_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="outline" className="h-9 rounded-md">
              Apply filters
            </Button>
            {hasBoardFilters(filters) ? (
              <Button asChild variant="ghost" className="h-9 rounded-md">
                <Link href="/board">Clear</Link>
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      {result.status === "error" ? (
        <EmptyState
          icon={AlertTriangle}
          title="The job board could not load"
          description="The public board connection is unavailable right now. No private or unreviewed records were shown."
          actionLabel="Try again"
          onActionHref="/board"
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title={hasBoardFilters(filters) ? "No roles match these filters" : "No reviewed roles are available"}
          description={
            hasBoardFilters(filters)
              ? "Clear or widen the filters to see more of the current curated set."
              : "Approved, active roles will appear here after review. Expired postings stay hidden automatically."
          }
          actionLabel={hasBoardFilters(filters) ? "Clear filters" : "Build your profile"}
          onActionHref={hasBoardFilters(filters) ? "/board" : "/start"}
        />
      ) : (
        <section aria-labelledby="board-results-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="board-results-title" className="text-sm font-semibold">
                Reviewed roles
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {jobs.length} {jobs.length === 1 ? "role" : "roles"} in this curated set
              </p>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Applying happens on the employer&apos;s site
            </p>
          </div>
          <div className="space-y-3">
            {jobs.map((job) => (
              <PublicJobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
