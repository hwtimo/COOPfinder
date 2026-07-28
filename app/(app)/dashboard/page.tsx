import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle } from "lucide-react";

import { CardSection } from "@/components/app/card-section";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { getLoginHref } from "@/lib/auth/paths";
import { getDashboardData } from "@/lib/dashboard/queries";
import { buildDashboardViewModel } from "@/lib/dashboard/view-model";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getSupabaseUser } from "@/lib/supabase/user";

export const dynamic = "force-dynamic";

function DashboardUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your saved jobs and application activity."
      />
      <EmptyState
        icon={AlertTriangle}
        title={title}
        description={description}
      />
    </div>
  );
}

export default async function DashboardPage() {
  if (!getSupabaseEnv()) {
    return (
      <DashboardUnavailable
        title="Dashboard unavailable"
        description="Supabase is not configured for this build. No saved-job or application data can be shown."
      />
    );
  }

  const user = await getSupabaseUser();
  if (!user) redirect(getLoginHref("/dashboard"));

  const result = await getDashboardData(user.id);
  if (result.status === "error") {
    return (
      <DashboardUnavailable
        title="Dashboard could not load"
        description="Your private jobs and applications are temporarily unavailable. No fallback data is shown."
      />
    );
  }

  const dashboard = buildDashboardViewModel(result.data);
  const currentMilestoneId =
    dashboard.mode === "onboarding"
      ? dashboard.primaryAction.id.replace("onboarding:", "")
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your next step, based on saved workspace progress."
      />

      {dashboard.mode === "onboarding" ? (
        <CardSection
          title="Getting started"
          description="Complete these four steps in order"
        >
          <div className="space-y-5">
            <ol className="grid gap-3 sm:grid-cols-2">
              {dashboard.onboardingMilestones.map((milestone) => {
                const isCurrent = milestone.id === currentMilestoneId;

                return (
                  <li
                    key={milestone.id}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`flex items-center gap-3 border p-3 ${
                      isCurrent
                        ? "border-brand/30 bg-brand-soft"
                        : "border-border"
                    }`}
                  >
                    {milestone.complete ? (
                      <CheckCircle2
                        className="size-4 shrink-0 text-success"
                        aria-hidden
                      />
                    ) : (
                      <Circle
                        className={`size-4 shrink-0 ${
                          isCurrent ? "text-brand" : "text-muted-foreground"
                        }`}
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {milestone.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {milestone.complete
                          ? "Complete"
                          : isCurrent
                            ? "Current step"
                            : "Upcoming"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="border-t pt-4">
              <h2 className="text-base font-semibold text-foreground">
                {dashboard.primaryAction.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {dashboard.primaryAction.description}
              </p>
              <Button asChild className="mt-4">
                <Link href={dashboard.primaryAction.href}>
                  Continue
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </CardSection>
      ) : (
        <CardSection
          title="Next action"
          description="Based on your saved workspace progress"
        >
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {dashboard.primaryAction.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {dashboard.primaryAction.description}
              </p>
              <Button asChild className="mt-4">
                <Link href={dashboard.primaryAction.href}>
                  Open next action
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>

            {dashboard.queuedActions.length > 0 ? (
              <div className="border-t pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Up next
                </p>
                <ul className="mt-2 divide-y">
                  {dashboard.queuedActions.map((action) => (
                    <li key={action.id}>
                      <Link
                        href={action.href}
                        className="flex items-center justify-between gap-3 py-3 text-sm text-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span>{action.title}</span>
                        <ArrowRight
                          className="size-3.5 shrink-0"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </CardSection>
      )}
    </div>
  );
}
