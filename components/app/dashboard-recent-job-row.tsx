import Link from "next/link";

import { formatPrivateJobDate } from "@/lib/jobs/dates";

import type { DashboardJob } from "@/lib/dashboard/types";
import type { PrivateJobStatus } from "@/lib/jobs/types";

const statusLabels: Record<PrivateJobStatus, string> = {
  saved: "Saved",
  tailoring: "Tailoring",
  ready: "Ready",
  applied: "Applied",
  oa: "Online assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export function DashboardRecentJobRow({ job }: { job: DashboardJob }) {
  return (
    <tr className="transition-colors hover:bg-muted/50">
      <td className="px-5 py-3">
        <Link
          href={`/jobs/${job.id}`}
          aria-label={`Open job detail for ${job.title}`}
          className="rounded-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {job.title}
        </Link>
      </td>
      <td className="px-5 py-3 text-text-secondary">
        {job.companyName ?? "Company not added"}
      </td>
      <td className="px-5 py-3 text-text-secondary">
        {job.location ?? "Location not added"}
      </td>
      <td className="px-5 py-3 text-text-secondary">
        {statusLabels[job.status]}
      </td>
      <td className="px-5 py-3 text-text-secondary">
        {formatPrivateJobDate(job.deadline)}
      </td>
      <td className="px-5 py-3 text-right text-text-secondary">
        {formatPrivateJobDate(job.updatedAt)}
      </td>
    </tr>
  );
}
