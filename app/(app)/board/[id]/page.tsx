import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  ExternalLink,
  MapPin,
} from "lucide-react";

import { CardSection } from "@/components/app/card-section";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { DeadlineBadge } from "@/components/app/status-badge";
import { GuestDraftMatchNote } from "@/components/board/guest-draft-match-note";
import { SaveBoardJobButton } from "@/components/board/save-board-job-button";
import { Button } from "@/components/ui/button";
import { getLoginHref } from "@/lib/auth/paths";
import {
  daysUntilBoardDeadline,
  formatBoardDate,
  formatBoardDeadline,
} from "@/lib/board/dates";
import { getPublicBoardJob } from "@/lib/board/queries";
import { getPrivateJobByBoardId } from "@/lib/jobs/queries";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getSupabaseUser } from "@/lib/supabase/user";

export const dynamic = "force-dynamic";

type BoardDetailPageProps = {
  params: Promise<{ id: string }>;
};

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Skills({ skills }: { skills: string[] }) {
  if (skills.length === 0) {
    return <p className="text-sm text-muted-foreground">Not listed in the reviewed summary.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <span
          key={skill}
          className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-text-secondary"
        >
          {skill}
        </span>
      ))}
    </div>
  );
}

export default async function BoardDetailPage({ params }: BoardDetailPageProps) {
  const { id } = await params;
  const configured = Boolean(getSupabaseEnv());
  const [result, user] = await Promise.all([
    getPublicBoardJob(id),
    getSupabaseUser(),
  ]);

  if (result.status === "ready" && !result.data) notFound();

  if (result.status === "error") {
    return (
      <div className="space-y-5">
        <Link
          href="/board"
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to job board
        </Link>
        <EmptyState
          icon={AlertTriangle}
          title="This reviewed role could not load"
          description="The public board connection is unavailable right now. No private or moderation data was shown."
          actionLabel="Return to job board"
          onActionHref="/board"
        />
      </div>
    );
  }

  const job = result.data;
  if (!job) notFound();
  const daysLeft = daysUntilBoardDeadline(job.deadline);
  const savedJob = user
    ? await getPrivateJobByBoardId(user.id, job.id)
    : null;

  return (
    <div className="space-y-5">
      <Link
        href="/board"
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to job board
      </Link>

      {result.source === "fixture" ? (
        <div className="rounded-md border border-info/20 bg-info-soft px-3 py-2 text-xs leading-5 text-foreground">
          Supabase is not configured for this local build. This detail comes
          from the isolated, public-safe starter set used by onboarding.
        </div>
      ) : null}

      <PageHeader
        title={job.title}
        description={`${job.companyName}${job.location ? ` · ${job.location}` : ""}`}
        actions={
          <Button asChild variant="outline" className="h-9 rounded-md">
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View original posting
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
                  Summary by COOPfinder
                </span>
                <h2 className="mt-3 text-base font-semibold">Reviewed role summary</h2>
              </div>
              {daysLeft === null ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-text-secondary">
                  No deadline listed
                </span>
              ) : (
                <DeadlineBadge
                  daysLeft={daysLeft}
                  label={formatBoardDeadline(job.deadline)}
                />
              )}
            </div>
            <p className="mt-4 text-sm leading-7 text-text-secondary">
              {job.summary}
            </p>
            <p className="mt-4 border-t pt-4 text-xs leading-5 text-muted-foreground">
              This is an in-house summary, not the employer&apos;s full posting.
              Verify responsibilities, requirements, and dates on the original
              source before applying.
            </p>
          </section>

          <CardSection title="Role facts" description="Structured details from the reviewed board entry">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Fact
                icon={<MapPin className="size-3.5" aria-hidden />}
                label="Location"
              >
                {job.location ?? "Not listed"}
              </Fact>
              <Fact
                icon={<BriefcaseBusiness className="size-3.5" aria-hidden />}
                label="Work mode"
              >
                {job.workMode ?? "Not listed"}
              </Fact>
              <Fact
                icon={<CalendarDays className="size-3.5" aria-hidden />}
                label="Term"
              >
                {job.term ?? "Not listed"}
              </Fact>
              <Fact
                icon={<CalendarDays className="size-3.5" aria-hidden />}
                label="Deadline"
              >
                {formatBoardDate(job.deadline)}
              </Fact>
              <Fact
                icon={<BriefcaseBusiness className="size-3.5" aria-hidden />}
                label="Work authorization note"
              >
                {job.workAuthorization ?? "Not listed"}
              </Fact>
              <Fact
                icon={<CalendarDays className="size-3.5" aria-hidden />}
                label="Last reviewed"
              >
                {formatBoardDate(job.lastCheckedAt)}
              </Fact>
            </dl>
          </CardSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <CardSection title="Required skills">
              <Skills skills={job.requiredSkills} />
            </CardSection>
            <CardSection title="Nice-to-have skills">
              <Skills skills={job.niceToHaveSkills} />
            </CardSection>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <GuestDraftMatchNote job={job} />

          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold">Keep this role in your workflow</h2>
            {!configured ? (
              <>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Supabase is not configured for this build. No private job will
                  be fabricated or saved locally.
                </p>
                <Button
                  type="button"
                  className="mt-4 h-9 w-full rounded-md"
                  disabled
                  title="Supabase is not configured"
                >
                  Save to My jobs
                </Button>
              </>
            ) : user ? (
              savedJob?.status === "error" ? (
                <>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    COOPfinder could not verify whether this role is already in
                    your private jobs. Nothing was written.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 h-9 w-full rounded-md"
                    disabled
                  >
                    Save unavailable
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Save the public metadata to your private list. The board
                    summary is not copied as an original job description.
                  </p>
                  <SaveBoardJobButton
                    boardJobId={job.id}
                    existingJobId={savedJob?.data?.id}
                  />
                </>
              )
            ) : (
              <>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Log in to save this reviewed role to your private jobs. Your
                  public browsing stays open.
                </p>
                <Button className="mt-4 h-9 w-full rounded-md" asChild>
                  <Link href={getLoginHref(`/board/${job.id}`, "save_job")}>
                    Log in to save this job
                  </Link>
                </Button>
              </>
            )}
          </section>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold">Original source</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              COOPfinder does not submit applications. Review and apply on the
              employer&apos;s site.
            </p>
            <Button asChild variant="outline" className="mt-4 h-9 w-full rounded-md">
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View original posting
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
