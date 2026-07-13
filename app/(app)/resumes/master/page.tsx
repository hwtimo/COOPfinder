import { redirect } from "next/navigation";
import { AlertTriangle, LockKeyhole } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { getLoginHref } from "@/lib/auth/paths";
import { getMasterProfile } from "@/lib/master-profile/queries";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getSupabaseUser } from "@/lib/supabase/user";

import { MasterProfileClient } from "./master-profile-client";

export const dynamic = "force-dynamic";

export default async function MasterProfilePage() {
  if (!getSupabaseEnv()) {
    return (
      <EmptyState
        icon={LockKeyhole}
        title="Master profile unavailable"
        description="Supabase is not configured for this build. No mock profile is shown and profile saving is disabled."
      />
    );
  }

  const user = await getSupabaseUser();
  if (!user) redirect(getLoginHref("/resumes/master"));

  const result = await getMasterProfile(user.id, user.email ?? "");
  if (result.status === "error") {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Master profile could not load"
        description="Your private profile connection is unavailable. No mock or cross-user data was shown."
      />
    );
  }

  const profileRevision = [
    result.data.fullName,
    result.data.school,
    result.data.targetRoles.join("|"),
    result.data.skills.join("|"),
    result.data.entries.map((entry) => entry.id).join("|"),
  ].join(":");

  return <MasterProfileClient key={profileRevision} initialData={result.data} />;
}
