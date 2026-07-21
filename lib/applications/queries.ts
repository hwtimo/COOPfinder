import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/jobs/queries";

import {
  APPLICATION_TRACKER_COLUMNS,
  type ApplicationDetail,
  type ApplicationDetailJob,
  type ApplicationDetailQueryResult,
  type ApplicationJobSummary,
  type ApplicationTimelineEvent,
  type ApplicationTrackingLink,
  type ApplicationTrackingLinkQueryResult,
  type ApplicationTrackingLinksQueryResult,
  type ApplicationTrackerData,
  type ApplicationTrackerQueryResult,
  type ApplicationTrackerStatus,
  type TrackerApplication,
} from "./types";

const APPLICATION_TRACKING_LINK_COLUMNS = "id,job_posting_id,status";

const APPLICATION_COLUMNS = [
  "id",
  "job_posting_id",
  "status",
  "deadline",
  "follow_up_due",
  "applied_at",
  "last_action",
  "next_action",
  "sort_order",
  "created_at",
  "updated_at",
].join(",");

const JOB_DISPLAY_COLUMNS = [
  "id",
  "title",
  "location",
  "work_mode",
  "deadline",
  "status",
  "updated_at",
  "company:companies!job_postings_company_id_fkey(name)",
].join(",");

const EMPTY_DATA: ApplicationTrackerData = {
  applications: [],
  eligibleJobs: [],
  savedJobCount: 0,
};

type ApplicationRow = {
  id: string;
  job_posting_id: string;
  status: string;
  deadline: string | null;
  follow_up_due: string | null;
  applied_at: string | null;
  last_action: string | null;
  next_action: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type CompanyRelation = { name: string };

type JobDisplayRow = {
  id: string;
  title: string;
  location: string | null;
  work_mode: string | null;
  deadline: string | null;
  status: string;
  updated_at: string;
  company: CompanyRelation | CompanyRelation[] | null;
};

type ApplicationDetailRow = {
  id: string;
  job_posting_id: string;
  status: string;
  notes: string | null;
  deadline: string | null;
  follow_up_due: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApplicationDetailJobRow = {
  id: string;
  title: string;
  location: string | null;
  work_mode: string | null;
  deadline: string | null;
  term: string | null;
  source_url: string | null;
  company: CompanyRelation | CompanyRelation[] | null;
};

type ApplicationTimelineEventRow = {
  id: string;
  event_type: string;
  event_at: string;
  metadata: unknown;
  created_at: string;
};

const canonicalStatuses = new Set<string>(
  APPLICATION_TRACKER_COLUMNS.map((column) => column.id),
);

function isTrackerStatus(value: string): value is ApplicationTrackerStatus {
  return canonicalStatuses.has(value);
}

function companyName(relation: JobDisplayRow["company"]): string | null {
  const company = Array.isArray(relation) ? relation[0] : relation;
  return company?.name ?? null;
}

function toJobSummary(row: JobDisplayRow): ApplicationJobSummary {
  return {
    id: row.id,
    title: row.title,
    companyName: companyName(row.company),
    location: row.location,
    workMode: row.work_mode,
    deadline: row.deadline,
  };
}

function toDetailJob(row: ApplicationDetailJobRow): ApplicationDetailJob {
  return {
    id: row.id,
    title: row.title,
    companyName: companyName(row.company),
    location: row.location,
    workMode: row.work_mode,
    deadline: row.deadline,
    term: row.term,
    sourceUrl: row.source_url,
  };
}

function timelineMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toTrackingLink(row: {
  id: string;
  job_posting_id: string;
  status: string;
}): ApplicationTrackingLink | null {
  if (
    !isUuid(row.id) ||
    !isUuid(row.job_posting_id) ||
    !isTrackerStatus(row.status)
  ) {
    return null;
  }
  return {
    id: row.id,
    jobPostingId: row.job_posting_id,
    status: row.status,
  };
}

export async function getOwnedApplicationTrackingLinks(
  userId: string,
): Promise<ApplicationTrackingLinksQueryResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: [] };

  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_TRACKING_LINK_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) return { status: "error", data: [] };
  const links = ((data ?? []) as unknown as Array<{
    id: string;
    job_posting_id: string;
    status: string;
  }>).map(toTrackingLink);
  if (links.some((link) => link === null)) {
    return { status: "error", data: [] };
  }
  return { status: "ready", data: links as ApplicationTrackingLink[] };
}

export async function getOwnedApplicationTrackingLinkForJob(
  userId: string,
  jobPostingId: string,
): Promise<ApplicationTrackingLinkQueryResult> {
  if (!isUuid(jobPostingId)) return { status: "ready", data: null };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: null };

  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_TRACKING_LINK_COLUMNS)
    .eq("user_id", userId)
    .eq("job_posting_id", jobPostingId)
    .maybeSingle();

  if (error) return { status: "error", data: null };
  if (!data) return { status: "ready", data: null };
  const link = toTrackingLink(data as unknown as {
    id: string;
    job_posting_id: string;
    status: string;
  });
  return link
    ? { status: "ready", data: link }
    : { status: "error", data: null };
}

export async function getApplicationTrackerData(
  userId: string,
): Promise<ApplicationTrackerQueryResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: EMPTY_DATA };

  const [applicationsResult, jobsResult] = await Promise.all([
    supabase
      .from("applications")
      .select(APPLICATION_COLUMNS)
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }),
    supabase
      .from("job_postings")
      .select(JOB_DISPLAY_COLUMNS)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }),
  ]);

  if (applicationsResult.error || jobsResult.error) {
    return { status: "error", data: EMPTY_DATA };
  }

  const applicationRows = (applicationsResult.data ?? []) as unknown as ApplicationRow[];
  const jobRows = (jobsResult.data ?? []) as unknown as JobDisplayRow[];

  if (applicationRows.some((row) => !isTrackerStatus(row.status))) {
    return { status: "error", data: EMPTY_DATA };
  }

  const jobsById = new Map(
    jobRows.map((row) => [row.id, toJobSummary(row)] as const),
  );
  const trackedJobIds = new Set(
    applicationRows.map((application) => application.job_posting_id),
  );
  const savedJobs = jobRows.filter((job) => job.status === "saved");

  const applications: TrackerApplication[] = applicationRows.map((row) => ({
    id: row.id,
    jobPostingId: row.job_posting_id,
    status: row.status as ApplicationTrackerStatus,
    deadline: row.deadline,
    followUpDue: row.follow_up_due,
    appliedAt: row.applied_at,
    lastAction: row.last_action,
    nextAction: row.next_action,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    job: jobsById.get(row.job_posting_id) ?? null,
  }));

  return {
    status: "ready",
    data: {
      applications,
      eligibleJobs: savedJobs
        .filter((job) => !trackedJobIds.has(job.id))
        .map(toJobSummary),
      savedJobCount: savedJobs.length,
    },
  };
}

export async function getApplicationDetail(
  userId: string,
  applicationId: string,
): Promise<ApplicationDetailQueryResult> {
  if (!isUuid(applicationId)) return { status: "ready", data: null };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: null };

  const applicationResult = await supabase
    .from("applications")
    .select(
      "id,job_posting_id,status,notes,deadline,follow_up_due,applied_at,created_at,updated_at",
    )
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (applicationResult.error) return { status: "error", data: null };
  if (!applicationResult.data) return { status: "ready", data: null };

  const application = applicationResult.data as unknown as ApplicationDetailRow;
  if (!isTrackerStatus(application.status)) {
    return { status: "error", data: null };
  }

  const [jobResult, timelineResult] = await Promise.all([
    supabase
      .from("job_postings")
      .select(
        "id,title,location,term,work_mode,deadline,source_url,company:companies!job_postings_company_id_fkey(name)",
      )
      .eq("id", application.job_posting_id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("application_timeline_events")
      .select("id,event_type,event_at,metadata,created_at")
      .eq("application_id", application.id)
      .eq("user_id", userId)
      .order("event_at", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (jobResult.error || timelineResult.error || !jobResult.data) {
    return { status: "error", data: null };
  }

  const job = toDetailJob(
    jobResult.data as unknown as ApplicationDetailJobRow,
  );
  const timeline: ApplicationTimelineEvent[] = (
    (timelineResult.data ?? []) as unknown as ApplicationTimelineEventRow[]
  ).map((event) => ({
    id: event.id,
    eventType: event.event_type,
    eventAt: event.event_at,
    metadata: timelineMetadata(event.metadata),
    createdAt: event.created_at,
  }));

  const detail: ApplicationDetail = {
    id: application.id,
    jobPostingId: application.job_posting_id,
    status: application.status,
    notes: application.notes,
    deadline: application.deadline,
    followUpDue: application.follow_up_due,
    appliedAt: application.applied_at,
    createdAt: application.created_at,
    updatedAt: application.updated_at,
    job,
    timeline,
  };

  return { status: "ready", data: detail };
}
