import { redirect } from "next/navigation";

import { getPrivateJobs } from "@/lib/jobs/queries";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getSupabaseUser } from "@/lib/supabase/user";

import { JobsPageClient } from "./jobs-page-client";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const configured = Boolean(getSupabaseEnv());

  if (!configured) {
    return <JobsPageClient jobs={[]} configured={false} loadError={false} />;
  }

  const user = await getSupabaseUser();
  if (!user) redirect("/board");

  const result = await getPrivateJobs(user.id);

  return (
    <JobsPageClient
      jobs={result.data}
      configured
      loadError={result.status === "error"}
    />
  );
}
