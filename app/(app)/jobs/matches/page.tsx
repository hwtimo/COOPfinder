import { AlertTriangle, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { JobMatchList } from "@/components/jobs/job-match-list";
import { getFirstSearchParam, getLoginHref } from "@/lib/auth/paths";
import {
  getOwnedJobMatches,
} from "@/lib/matching/get-owned-job-matches";
import type { OwnedJobMatchesSort } from "@/lib/matching/job-match-summary";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type JobMatchesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function selectedSort(value: string | undefined): OwnedJobMatchesSort {
  if (value === "missing_required" || value === "recently_updated") {
    return value;
  }
  return "required_evidence";
}

export default async function JobMatchesPage({
  searchParams,
}: JobMatchesPageProps) {
  if (!getSupabaseEnv()) {
    return (
      <EmptyState
        icon={LockKeyhole}
        title="Private matches unavailable"
        description="Supabase is not configured for this build. No mock jobs or profile evidence were shown."
      />
    );
  }

  const result = await getOwnedJobMatches();
  if (result.status === "unauthenticated") {
    redirect(getLoginHref("/jobs/matches"));
  }
  if (result.status === "unavailable") {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Profile matches could not load"
        description="Your private jobs and Master Profile could not be compared right now. No mock or cross-user data was shown."
        actionLabel="Return to jobs"
        onActionHref="/jobs"
      />
    );
  }

  const params = await searchParams;
  const sort = selectedSort(getFirstSearchParam(params.sort));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile matches"
        description="Compare analyzed private jobs with exact, explicit evidence in your Master Profile. No overall score or hiring recommendation is calculated."
      />
      <JobMatchList jobs={result.jobs} sort={sort} />
    </div>
  );
}
