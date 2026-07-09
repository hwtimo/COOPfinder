"use client";

import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CardSection } from "@/components/app/card-section";
import { StatusBadge, DeadlineBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  daysUntil,
  formatDeadline,
  mockJobs,
  type JobRoleType,
  type MockJob,
  type WorkAuthorization,
  type WorkMode,
} from "@/lib/mock";

type DeadlineFilter = "all" | "overdue" | "today" | "48h" | "7d" | "later";
type MatchFilter = "all" | "80" | "70" | "50" | "unanalyzed";

interface JobFilters {
  roleType: "all" | JobRoleType;
  location: string;
  term: string;
  workMode: "all" | WorkMode;
  coopEligible: "all" | "yes" | "no";
  workAuthorization: "all" | WorkAuthorization;
  deadline: DeadlineFilter;
  matchScore: MatchFilter;
}

interface AddJobForm {
  sourceUrl: string;
  description: string;
  company: string;
  role: string;
  location: string;
  deadline: string;
  term: string;
  workMode: WorkMode;
  notes: string;
}

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

const initialForm: AddJobForm = {
  sourceUrl: "",
  description: "",
  company: "",
  role: "",
  location: "",
  deadline: "",
  term: "Fall 2026 · 4 months",
  workMode: "Hybrid",
  notes: "",
};

const filterSelectClassName =
  "h-9 min-w-36 rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50";

const labelClassName = "text-[11px] font-medium text-muted-foreground";

function uniqueValues(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function inferRoleType(role: string): JobRoleType {
  const normalized = role.toLowerCase();
  if (normalized.includes("embedded") || normalized.includes("systems")) {
    return "Embedded";
  }
  if (normalized.includes("data") || normalized.includes("analyst")) {
    return "Data";
  }
  if (normalized.includes("cloud") || normalized.includes("platform")) {
    return "Cloud";
  }
  if (normalized.includes("full stack") || normalized.includes("full-stack")) {
    return "Full stack";
  }
  if (normalized.includes("network")) {
    return "Network";
  }
  return "Software";
}

function matchesDeadlineFilter(deadline: string, filter: DeadlineFilter) {
  const days = daysUntil(deadline);
  if (filter === "overdue") return days < 0;
  if (filter === "today") return days === 0;
  if (filter === "48h") return days >= 0 && days <= 2;
  if (filter === "7d") return days >= 0 && days <= 7;
  if (filter === "later") return days > 7;
  return true;
}

function matchesScoreFilter(match: number | null, filter: MatchFilter) {
  if (filter === "unanalyzed") return match === null;
  if (filter === "80") return match !== null && match >= 80;
  if (filter === "70") return match !== null && match >= 70;
  if (filter === "50") return match !== null && match >= 50;
  return true;
}

function formatLastUpdated(iso: string) {
  const days = daysUntil(iso);
  if (days === 0) return "Today";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${Math.abs(days)}d ago`;
  return "Upcoming";
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

function TextAreaField({
  id,
  name,
  label,
  value,
  onChange,
  required,
  rows = 4,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label htmlFor={id} className="grid gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <textarea
        id={id}
        name={name}
        value={value}
        required={required}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
      />
    </label>
  );
}

function AddJobModal({
  form,
  onFormChange,
  onClose,
  onSubmit,
}: {
  form: AddJobForm;
  onFormChange: (form: AddJobForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const setField = <K extends keyof AddJobForm>(
    key: K,
    value: AddJobForm[K],
  ) => {
    onFormChange({ ...form, [key]: value });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 px-4 py-10"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-job-title"
        className="w-full max-w-3xl rounded-xl border bg-card"
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 id="add-job-title" className="text-base font-semibold">
              Add job
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Save the posting details for resume tailoring and tracking.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close add job"
            className="rounded-md text-muted-foreground"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label htmlFor="job-url" className="grid gap-1.5 md:col-span-2">
              <span className="text-xs font-medium text-foreground">
                Job URL
              </span>
              <Input
                id="job-url"
                name="sourceUrl"
                type="url"
                value={form.sourceUrl}
                onChange={(event) => setField("sourceUrl", event.target.value)}
                className="h-9 rounded-md bg-card text-sm"
                placeholder="https://company.ca/careers/co-op-role"
              />
            </label>

            <TextAreaField
              id="job-description"
              name="description"
              label="Paste job description"
              value={form.description}
              required
              onChange={(value) => setField("description", value)}
            />

            <TextAreaField
              id="job-notes"
              name="notes"
              label="Notes"
              value={form.notes}
              rows={4}
              onChange={(value) => setField("notes", value)}
            />

            <label htmlFor="company" className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">
                Company
              </span>
              <Input
                id="company"
                name="company"
                value={form.company}
                required
                onChange={(event) => setField("company", event.target.value)}
                className="h-9 rounded-md bg-card text-sm"
              />
            </label>

            <label htmlFor="role" className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">Role</span>
              <Input
                id="role"
                name="role"
                value={form.role}
                required
                onChange={(event) => setField("role", event.target.value)}
                className="h-9 rounded-md bg-card text-sm"
              />
            </label>

            <label htmlFor="location" className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">
                Location
              </span>
              <Input
                id="location"
                name="location"
                value={form.location}
                required
                onChange={(event) => setField("location", event.target.value)}
                className="h-9 rounded-md bg-card text-sm"
              />
            </label>

            <label htmlFor="deadline" className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">
                Deadline
              </span>
              <Input
                id="deadline"
                name="deadline"
                type="date"
                value={form.deadline}
                required
                onChange={(event) => setField("deadline", event.target.value)}
                className="h-9 rounded-md bg-card text-sm"
              />
            </label>

            <label htmlFor="term" className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">Term</span>
              <select
                id="term"
                name="term"
                value={form.term}
                onChange={(event) => setField("term", event.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              >
                <option>Fall 2026 · 4 months</option>
                <option>Fall 2026 · 8 months</option>
                <option>Winter 2027 · 4 months</option>
                <option>Winter 2027 · 8 months</option>
                <option>Summer 2027 · 4 months</option>
              </select>
            </label>

            <label htmlFor="work-mode" className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">
                Work mode
              </span>
              <select
                id="work-mode"
                name="workMode"
                value={form.workMode}
                onChange={(event) =>
                  setField("workMode", event.target.value as WorkMode)
                }
                className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              >
                <option>Hybrid</option>
                <option>Remote</option>
                <option>On-site</option>
              </select>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-md"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-9 rounded-md">
              Save job
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function JobsPageClient() {
  const router = useRouter();
  const [jobs, setJobs] = useState<MockJob[]>(mockJobs);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<JobFilters>(initialFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<AddJobForm>(initialForm);

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
        job.company,
        job.role,
        job.location,
        job.term,
        job.workMode,
        job.notes,
      ]
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
        matchesScoreFilter(job.match, filters.matchScore)
      );
    });
  }, [filters, jobs, search]);

  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== "all",
  ).length;

  const openJob = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    jobId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openJob(jobId);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const getValue = (name: keyof AddJobForm) =>
      (formData.get(name)?.toString() ?? form[name]).trim();

    const company = getValue("company");
    const role = getValue("role");
    const location = getValue("location");
    const deadline = getValue("deadline");
    const term = getValue("term");
    const workMode = getValue("workMode") as WorkMode;
    const sourceUrl = getValue("sourceUrl");
    const description = getValue("description");
    const notes = getValue("notes");

    const newJob: MockJob = {
      id: `local-${Date.now()}`,
      company,
      role,
      location,
      roleType: inferRoleType(role),
      workMode,
      term,
      deadline,
      match: null,
      status: "saved",
      resumeVersion: null,
      coopEligible: true,
      workAuthorization: "International eligible",
      sourceUrl,
      description,
      notes,
      savedAt: "2026-07-08",
      updatedAt: "2026-07-08",
      nextAction: "Tailor resume",
    };

    setJobs((currentJobs) => [newJob, ...currentJobs]);
    setForm(initialForm);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Your saved job postings, ready to analyze and tailor."
        actions={
          <Button
            type="button"
            className="h-9 rounded-md"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="size-3.5" aria-hidden />
            Add job
          </Button>
        }
      />

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
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  roleType: value as JobFilters["roleType"],
                }))
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
              onChange={(value) =>
                setFilters((current) => ({ ...current, location: value }))
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
              onChange={(value) =>
                setFilters((current) => ({ ...current, term: value }))
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
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  workMode: value as JobFilters["workMode"],
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
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  coopEligible: value as JobFilters["coopEligible"],
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
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  workAuthorization: value as JobFilters["workAuthorization"],
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
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  deadline: value as DeadlineFilter,
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
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  matchScore: value as MatchFilter,
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
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              No jobs saved yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
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
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              No jobs match these filters
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Clear a filter or search term to bring more saved jobs back into
              view.
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
                  <th className="px-5 py-2.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${job.company} ${job.role} details`}
                    onClick={() => openJob(job.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, job.id)}
                    className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">
                        {job.company}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {job.coopEligible
                          ? "Co-op eligible"
                          : "Eligibility not marked"}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{job.role}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {job.roleType}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {job.location}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {job.term}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                        {job.workMode}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <DeadlineBadge
                        daysLeft={daysUntil(job.deadline)}
                        label={formatDeadline(job.deadline)}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
                          matchTone(job.match),
                        )}
                      >
                        {job.match === null ? "Not analyzed" : `${job.match}%`}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {formatLastUpdated(job.updatedAt)}
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
                        {job.nextAction}
                        <ArrowRight className="size-3" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardSection>

      {isModalOpen ? (
        <AddJobModal
          form={form}
          onFormChange={setForm}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
