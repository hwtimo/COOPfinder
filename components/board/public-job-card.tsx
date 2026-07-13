import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  ExternalLink,
  MapPin,
} from "lucide-react";

import { DeadlineBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  daysUntilBoardDeadline,
  formatBoardDate,
  formatBoardDeadline,
} from "@/lib/board/dates";
import type { PublicBoardJob } from "@/lib/board/types";

function SkillPills({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.slice(0, 4).map((skill) => (
        <span
          key={skill}
          className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-text-secondary"
        >
          {skill}
        </span>
      ))}
    </div>
  );
}

export function PublicJobCard({ job }: { job: PublicBoardJob }) {
  const daysLeft = daysUntilBoardDeadline(job.deadline);

  return (
    <article className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/board/${job.id}`}
              className="text-base font-semibold text-foreground hover:text-brand focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {job.title}
            </Link>
            {daysLeft === null ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                No deadline listed
              </span>
            ) : (
              <DeadlineBadge
                daysLeft={daysLeft}
                label={formatBoardDeadline(job.deadline)}
              />
            )}
          </div>

          <p className="mt-1 text-sm font-medium text-text-secondary">
            {job.companyName}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {job.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {job.location}
              </span>
            ) : null}
            {job.workMode ? (
              <span className="inline-flex items-center gap-1.5">
                <BriefcaseBusiness className="size-3.5" aria-hidden />
                {job.workMode}
              </span>
            ) : null}
            {job.term ? <span>{job.term}</span> : null}
          </div>

          <div className="mt-4 rounded-md border bg-background p-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">
              Summary by COOPfinder
            </p>
            <p className="mt-1.5 text-sm leading-6 text-text-secondary">
              {job.summary}
            </p>
          </div>

          <div className="mt-3">
            <SkillPills skills={job.requiredSkills} />
          </div>
        </div>

        <div className="flex shrink-0 flex-row flex-wrap gap-2 lg:w-44 lg:flex-col">
          <Button asChild variant="outline" className="h-9 rounded-md lg:w-full">
            <Link href={`/board/${job.id}`}>
              View details
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-9 rounded-md lg:w-full">
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View original posting
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
          <p className="w-full text-xs text-muted-foreground lg:text-center">
            Last reviewed {formatBoardDate(job.lastCheckedAt)}
          </p>
        </div>
      </div>
    </article>
  );
}
