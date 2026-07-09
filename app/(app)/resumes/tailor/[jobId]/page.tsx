import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, WandSparkles } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { TailoringWorkspace } from "./tailoring-workspace";
import {
  mockJobAnalyses,
  mockJobs,
  mockMasterResume,
  mockStudentProfile,
  mockTailoringSessions,
} from "@/lib/mock";

type TailorPageProps = {
  params: Promise<{ jobId: string }>;
};

export function generateStaticParams() {
  return mockJobs.map((job) => ({ jobId: job.id }));
}

export default async function TailorPage({ params }: TailorPageProps) {
  const { jobId } = await params;
  const job = mockJobs.find((item) => item.id === jobId);

  if (!job) {
    notFound();
  }

  const session = mockTailoringSessions[job.id];
  const analysis = mockJobAnalyses[job.id];

  /* Only jobs with a prepared mock session get the full workspace.
     Others get an honest "not generated yet" state instead of a 404. */
  if (!session || !analysis) {
    return (
      <div className="space-y-6">
        <Link
          href={`/jobs/${job.id}`}
          className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to job detail
        </Link>
        <PageHeader
          title="Tailor resume"
          description={`${job.company} — ${job.role}`}
        />
        <EmptyState
          icon={WandSparkles}
          title="No tailoring suggestions yet"
          description="Suggestions for this job haven't been generated in this mock build. Open the Northstar Robotics job to see the full tailoring workspace."
          actionLabel="Open example workspace"
          onActionHref="/resumes/tailor/j11"
        />
      </div>
    );
  }

  return (
    <TailoringWorkspace
      job={job}
      analysis={analysis}
      session={session}
      profile={mockStudentProfile}
      masterResume={mockMasterResume}
    />
  );
}
