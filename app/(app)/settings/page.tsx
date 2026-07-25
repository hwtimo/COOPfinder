import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { CardSection } from "@/components/app/card-section";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { getLoginHref } from "@/lib/auth/paths";
import { getSettingsAccount } from "@/lib/settings/get-settings-account";

export const dynamic = "force-dynamic";

function displayValue(value: string | null, fallback = "Not provided") {
  return value || fallback;
}

function SettingsHeader() {
  return (
    <PageHeader
      title="Settings"
      description="Your account and profile details."
    />
  );
}

export default async function SettingsPage() {
  const result = await getSettingsAccount();

  if (result.status === "unauthenticated") {
    redirect(getLoginHref("/settings"));
  }

  if (result.status === "unavailable") {
    return (
      <div className="max-w-[960px] space-y-6">
        <SettingsHeader />
        <EmptyState
          icon={AlertTriangle}
          title="Settings could not load"
          description="Your account details are temporarily unavailable. No fallback data is shown."
        />
      </div>
    );
  }

  return (
    <div className="max-w-[960px] space-y-6">
      <SettingsHeader />
      <CardSection
        title="Profile"
        description="Read-only account details. Profile editing is not available in Settings yet."
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Name</dt>
            <dd className="mt-0.5 text-foreground">
              {displayValue(result.account.name)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="mt-0.5 break-all text-foreground">
              {displayValue(result.account.email, "Not available")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">School</dt>
            <dd className="mt-0.5 text-foreground">
              {displayValue(result.account.school)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Program</dt>
            <dd className="mt-0.5 text-foreground">
              {displayValue(result.account.program)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Co-op term</dt>
            <dd className="mt-0.5 text-foreground">
              {displayValue(result.account.coopTerm)}
            </dd>
          </div>
        </dl>
      </CardSection>
    </div>
  );
}
