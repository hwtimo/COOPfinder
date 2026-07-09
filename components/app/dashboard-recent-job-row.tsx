"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import type { MockJob } from "@/lib/mock";

interface DashboardRecentJobRowProps {
  job: MockJob;
}

function nextActionHref(job: MockJob) {
  if (job.status === "tailoring" || job.nextAction.includes("Tailor")) {
    return `/resumes/tailor/${job.id}`;
  }
  return "/applications";
}

export function DashboardRecentJobRow({ job }: DashboardRecentJobRowProps) {
  const router = useRouter();
  const jobHref = `/jobs/${job.id}`;

  const openJob = () => {
    router.push(jobHref);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openJob();
    }
  };

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={`Open job detail for ${job.company} ${job.role}`}
      onClick={openJob}
      onKeyDown={handleKeyDown}
      className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <td className="px-5 py-3">
        <Link
          href={jobHref}
          onClick={(event) => event.stopPropagation()}
          className="rounded-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {job.role}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">{job.term}</p>
      </td>
      <td className="px-5 py-3 text-text-secondary">{job.company}</td>
      <td className="px-5 py-3 text-text-secondary">{job.location}</td>
      <td className="px-5 py-3">
        <StatusBadge status={job.status} />
      </td>
      <td className="px-5 py-3 text-text-secondary">
        {job.resumeVersion ?? "Not tailored"}
      </td>
      <td className="px-5 py-3 text-right text-text-secondary tabular-nums">
        {job.match === null ? "Not analyzed" : `${job.match}%`}
      </td>
      <td className="px-5 py-3 text-right">
        <Link
          href={nextActionHref(job)}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {job.nextAction}
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </td>
    </tr>
  );
}
