"use client";

import { KeyboardEvent, ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Database,
  GitCompareArrows,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { CardSection } from "@/components/app/card-section";
import { DeadlineBadge, StatusBadge } from "@/components/app/status-badge";
import { PageHeader } from "@/components/app/page-header";
import { AddPrivateJobModal } from "@/components/jobs/private-job-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  daysUntilPrivateJobDeadline,
  formatPrivateJobDeadline,
  formatPrivateJobUpdatedAt,
} from "@/lib/jobs/dates";
import type {
  PrivateJob,
  PrivateJobWorkAuthorization,
  PrivateJobWorkMode,
} from "@/lib/jobs/types";
import { cn } from "@/lib/utils";

type DeadlineFilter = "all" | "overdue" | "today" | "48h" | "7d" | "later";
type MatchFilter = "all" | "80" | "70" | "50" | "unanalyzed";

type JobFilters = {
  roleType: string;
  location: string;
  term: string;
  workMode: "all" | PrivateJobWorkMode;
  coopEligible: "all" | "yes" | "no";
  workAuthorization: "all" | PrivateJobWorkAuthorization;
  deadline: DeadlineFilter;
  matchScore: MatchFilter;
};

const initialFilters: JobFilters = {
  roleType: "all",
  location: "all",
  term: "all",
  workMode: "all",
  coopEligible: "all",
  workAuthorization: "all",
  deadline: "all",
  matchScore: "all",
};

const filterSelectClassName =
  "h-9 min-w-36 rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50";
const labelClassName = "text-[11px] font-medium text-muted-foreground";

function uniqueValues(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort(
    (a, b) => a.localeCompare(b),
  );
}

function matchesDeadlineFilter(
  deadline: string | null,
  filter: DeadlineFilter,
): boolean {
  if (filter === "all") return true;
  const days = daysUntilPrivateJobDeadline(deadline);
  if (days === null) return false;
  if (filter === "overdue") return days < 0;
  if (filter === "today") return days === 0;
  if (filter === "48h") return days >= 0 && days <= 2;
  if (filter === "7d") return days >= 0 && days <= 7;
  return days > 7;
}

function matchesScoreFilter(match: number | null, filter: MatchFilter) {
  if (filter === "unanalyzed") return match === null;
  if (filter === "80") return match !== null && match >= 80;
  if (filter === "70") return match !== null && match >= 70;
  if (filter === "50") return match !== null && match >= 50;
  return true;
}

function matchTone(match: number | null) {
  if (match === null) return "bg-muted text-text-secondary";
  if (match >= 80) return "bg-success-soft text-success";
  if (match >= 70) return "bg-info-soft text-info";
  if (match >= 50) return "bg-warning-soft text-warning";
  return "bg-muted text-text-secondary";
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className={labelClassName}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={filterSelectClassName}
      >
        {children}
      </select>
    </label>
  );
}

export function JobsPageClient({
  jobs,
  configured,
  loadError,
}: {
  jobs: PrivateJob[];
  configured: boolean;
  loadError: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<JobFilters>(initialFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filterOptions = useMemo(
    () => ({
      roleTypes: uniqueValues(jobs.map((job) => job.roleType)),
      locations: uniqueValues(jobs.map((job) => job.location)),
      terms: uniqueValues(jobs.map((job) => job.term)),
      workModes: uniqueValues(jobs.map((job) => job.workMode)),
      authorizations: uniqueValues(jobs.map((job) => job.workAuthorization)),
    }),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return jobs.filter((job) => {
      const searchable = [
        job.companyName,
        job.title,
        job.roleType,
        job.location,
        job.term,
        job.workMode,
        job.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        (filters.roleType === "all" || job.roleType === filters.roleType) &&
        (filters.location === "all" || job.location === filters.location) &&
        (filters.term === "all" || job.term === filters.term) &&
        (filters.workMode === "all" || job.workMode === filters.workMode) &&
        (filters.coopEligible === "all" ||
          job.coopEligible === (filters.coopEligible === "yes")) &&
        (filters.workAuthorization === "all" ||
          job.workAuthorization === filters.workAuthorization) &&
        matchesDeadlineFilter(job.deadline, filters.deadline) &&
        matchesScoreFilter(job.matchScore, filters.matchScore)
      );
    });
  }, [filters, jobs, search]);

  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== "all",
  ).length;

  const openJob = (jobId: string) => router.push(`/jobs/${jobId}`);
  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    jobId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openJob(jobId);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Your private saved job postings, ready for review and tracking."
        actions={
          <>
            <Button asChild variant="outline" className="h-9 rounded-md">
              <Link href="/jobs/matches">
                <GitCompareArrows className="size-3.5" aria-hidden />
                Profile matches
              </Link>
            </Button>
            <Button
              type="button"
              className="h-9 rounded-md"
              onClick={() => setIsModalOpen(true)}
              disabled={!configured}
              title={!configured ? "Supabase is not configured" : undefined}
            >
              <Plus className="size-3.5" aria-hidden />
              Add job
            </Button>
          </>
        }
      />

      {!configured ? (
        <div className="rounded-lg border border-dashed bg-card px-4 py-12 text-center sm:px-6 sm:py-16">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-info-soft">
            <Database className="size-5 text-info" aria-hidden />
          </div>
          <h2 className="mt-4 text-sm font-semibold">Private jobs are unavailable</h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            Supabase is not configured for this build. No mock jobs are shown,
            and add, edit, or delete actions will not simulate persistence.
          </p>
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-dashed bg-card px-4 py-12 text-center sm:px-6 sm:py-16">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-warning-soft">
            <AlertTriangle className="size-5 text-warning" aria-hidden />
          </div>
          <h2 className="mt-4 text-sm font-semibold">Saved jobs could not load</h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            The private jobs connection is unavailable. No mock or cross-user
            data was shown.
          </p>
        </div>
      ) : (
        <CardSection
          title="Saved jobs"
          description={`${filteredJobs.length} of ${jobs.length} jobs shown`}
          contentClassName="p-0"
          action={
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
              Table view
            </span>
          }
        >
          <div className="border-b p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-end">
              <label htmlFor="jobs-search" className="grid gap-1">
                <span className={labelClassName}>Search</span>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="jobs-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search company, role, location, notes"
                    className="h-9 rounded-md bg-card pl-9 text-sm"
                  />
                </div>
              </label>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <SlidersHorizontal className="size-4" aria-hidden />
                <span>
                  {activeFilterCount === 0
                    ? "No filters active"
                    : `${activeFilterCount} filters active`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-md"
                  onClick={() => {
                    setFilters(initialFilters);
                    setSearch("");
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <FilterSelect
                label="Role type"
                value={filters.roleType}
                onChange={(roleType) =>
                  setFilters((current) => ({ ...current, roleType }))
                }
              >
                <option value="all">All roles</option>
                {filterOptions.roleTypes.map((roleType) => (
                  <option key={roleType} value={roleType}>
                    {roleType}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Location"
                value={filters.location}
                onChange={(location) =>
                  setFilters((current) => ({ ...current, location }))
                }
              >
                <option value="all">All locations</option>
                {filterOptions.locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Term"
                value={filters.term}
                onChange={(term) =>
                  setFilters((current) => ({ ...current, term }))
                }
              >
                <option value="all">All terms</option>
                {filterOptions.terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Work mode"
                value={filters.workMode}
                onChange={(workMode) =>
                  setFilters((current) => ({
                    ...current,
                    workMode: workMode as JobFilters["workMode"],
                  }))
                }
              >
                <option value="all">All modes</option>
                {filterOptions.workModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Co-op eligible"
                value={filters.coopEligible}
                onChange={(coopEligible) =>
                  setFilters((current) => ({
                    ...current,
                    coopEligible: coopEligible as JobFilters["coopEligible"],
                  }))
                }
              >
                <option value="all">Any</option>
                <option value="yes">Eligible</option>
                <option value="no">Not marked</option>
              </FilterSelect>

              <FilterSelect
                label="Work authorization"
                value={filters.workAuthorization}
                onChange={(workAuthorization) =>
                  setFilters((current) => ({
                    ...current,
                    workAuthorization:
                      workAuthorization as JobFilters["workAuthorization"],
                  }))
                }
              >
                <option value="all">Any authorization</option>
                {filterOptions.authorizations.map((authorization) => (
                  <option key={authorization} value={authorization}>
                    {authorization}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Deadline"
                value={filters.deadline}
                onChange={(deadline) =>
                  setFilters((current) => ({
                    ...current,
                    deadline: deadline as DeadlineFilter,
                  }))
                }
              >
                <option value="all">Any deadline</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due today</option>
                <option value="48h">Next 48 hours</option>
                <option value="7d">Next 7 days</option>
                <option value="later">Later</option>
              </FilterSelect>

              <FilterSelect
                label="Match score"
                value={filters.matchScore}
                onChange={(matchScore) =>
                  setFilters((current) => ({
                    ...current,
                    matchScore: matchScore as MatchFilter,
                  }))
                }
              >
                <option value="all">Any match</option>
                <option value="80">80%+</option>
                <option value="70">70%+</option>
                <option value="50">50%+</option>
                <option value="unanalyzed">Not analyzed</option>
              </FilterSelect>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Briefcase className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <h3 className="mt-4 text-sm font-semibold">No jobs saved yet</h3>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                Save your first job posting to analyze requirements, tailor your
                resume, and track your application.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-5 h-9 rounded-md"
                onClick={() => setIsModalOpen(true)}
              >
                Add first job
              </Button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Search className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <h3 className="mt-4 text-sm font-semibold">No jobs match these filters</h3>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                Clear a filter or search term to bring more saved jobs back into view.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-5 h-9 rounded-md"
                onClick={() => {
                  setFilters(initialFilters);
                  setSearch("");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1220px] text-sm">
                <thead className="bg-card">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Company</th>
                    <th className="px-5 py-2.5 font-medium">Role</th>
                    <th className="px-5 py-2.5 font-medium">Location</th>
                    <th className="px-5 py-2.5 font-medium">Term</th>
                    <th className="px-5 py-2.5 font-medium">Work mode</th>
                    <th className="px-5 py-2.5 font-medium">Deadline</th>
                    <th className="px-5 py-2.5 font-medium">Estimated match</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium">Last updated</th>
                    <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredJobs.map((job) => {
                    const deadlineDays = daysUntilPrivateJobDeadline(job.deadline);
                    return (
                      <tr
                        key={job.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Open ${job.companyName ?? "saved job"} ${job.title} details`}
                        onClick={() => openJob(job.id)}
                        onKeyDown={(event) => handleRowKeyDown(event, job.id)}
                        className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium text-foreground">
                            {job.companyName ?? "Company not listed"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {job.coopEligible ? "Co-op eligible" : "Eligibility not marked"}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-foreground">{job.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {job.roleType ?? "Not classified"}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-text-secondary">
                          {job.location ?? "Not listed"}
                        </td>
                        <td className="px-5 py-3 text-text-secondary">
                          {job.term ?? "Not listed"}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                            {job.workMode ?? "Not listed"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {deadlineDays === null ? (
                            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                              No deadline
                            </span>
                          ) : (
                            <DeadlineBadge
                              daysLeft={deadlineDays}
                              label={formatPrivateJobDeadline(job.deadline)}
                            />
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
                              matchTone(job.matchScore),
                            )}
                          >
                            {job.matchScore === null
                              ? "Not analyzed"
                              : `${job.matchScore}%`}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="px-5 py-3 text-text-secondary">
                          {formatPrivateJobUpdatedAt(job.updatedAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-md text-brand"
                            onClick={(event) => {
                              event.stopPropagation();
                              openJob(job.id);
                            }}
                          >
                            View details
                            <ArrowRight className="size-3" aria-hidden />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardSection>
      )}

      {isModalOpen ? (
        <AddPrivateJobModal onClose={() => setIsModalOpen(false)} />
      ) : null}
    </div>
  );
}
