import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { TailoringGenerationControl } from "@/components/app/tailor/tailoring-generation-control";
import { TailoringPreflightSummary } from "@/components/app/tailor/tailoring-preflight-summary";
import { getLoginHref } from "@/lib/auth/paths";
import { isUuid } from "@/lib/jobs/queries";
import { getCurrentTailoringCreditBalance } from "@/lib/tailoring/get-current-tailoring-credit-balance";
import { getOwnedTailoringPreflight } from "@/lib/tailoring/get-owned-tailoring-preflight";

type TailorPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function TailorPage({ params }: TailorPageProps) {
  const { jobId } = await params;
  if (!isUuid(jobId)) notFound();

  const [result, balance] = await Promise.all([
    getOwnedTailoringPreflight(jobId),
    getCurrentTailoringCreditBalance(),
  ]);

  if (
    result.status === "unauthenticated" ||
    balance.status === "unauthenticated"
  ) {
    redirect(getLoginHref(`/resumes/tailor/${jobId}`));
  }
  if (result.status === "not_found") notFound();

  const preflight =
    result.status === "ready" ||
    result.status === "insufficient_job_data" ||
    result.status === "insufficient_candidate_data"
      ? result.preflight
      : null;

  return (
    <div className="space-y-6">
      <Link
        href={`/jobs/${jobId}`}
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to job detail
      </Link>
      <PageHeader
        title="Tailoring preflight"
        description={
          preflight
            ? `${preflight.job.companyName} — ${preflight.job.title}`
            : "Review verified Master Profile evidence before generating a tailored resume."
        }
      />
      <TailoringPreflightSummary result={result} />
      <TailoringGenerationControl
        jobId={jobId}
        availableCredits={
          balance.status === "ready" ? balance.available : null
        }
        initialIdempotencyKey={randomUUID()}
        canGenerate={
          result.status === "ready" && result.preflight.readiness === "ready"
        }
      />
    </div>
  );
}
