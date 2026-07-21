import Link from "next/link";
import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  FileCheck2,
  FileSearch,
  Scale,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OwnedApplicationWorkflowResult } from "@/lib/applications/get-owned-application-workflow";

type WorkflowState =
  | "ready"
  | "comparable"
  | "not_analyzed"
  | "insufficient_profile"
  | "insufficient_job_data"
  | "analysis_required"
  | "none"
  | "unavailable";

const stateCopy: Record<WorkflowState, { label: string; description: string }> = {
  ready: {
    label: "Available",
    description: "This owner-scoped workflow step is available for review.",
  },
  comparable: {
    label: "Comparable",
    description: "Explicit requirements and profile evidence can be compared.",
  },
  not_analyzed: {
    label: "Not analyzed",
    description: "The linked private job does not have a saved analysis yet.",
  },
  insufficient_profile: {
    label: "More profile evidence needed",
    description: "The comparison has insufficient explicit profile evidence.",
  },
  insufficient_job_data: {
    label: "Limited job requirements",
    description: "The analysis has insufficient comparable job requirements.",
  },
  analysis_required: {
    label: "Analysis required",
    description: "Analyze the linked private job before reviewing this step.",
  },
  none: {
    label: "No complete saved resume",
    description: "No complete printable v2 resume is saved for this job.",
  },
  unavailable: {
    label: "Unavailable",
    description: "This workflow state could not be loaded safely.",
  },
};

function WorkflowItem({
  title,
  state,
  icon: Icon,
  action,
}: {
  title: string;
  state: WorkflowState;
  icon: typeof FileSearch;
  action?: ReactNode;
}) {
  const copy = stateCopy[state];
  return (
    <section className="flex min-w-0 flex-col rounded-md border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            {copy.label}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copy.description}
          </p>
        </div>
      </div>
      {action ? <div className="mt-auto pt-4">{action}</div> : null}
    </section>
  );
}

export function ApplicationWorkflowSummary({
  jobId,
  sourceUrl,
  result,
}: {
  jobId: string;
  sourceUrl: string | null;
  result: OwnedApplicationWorkflowResult;
}) {
  if (result.status !== "ready") {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Application workflow is temporarily unavailable. No saved records
          were changed.
        </p>
      </div>
    );
  }

  const { workflow } = result;
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        These independent states summarize saved records. They do not change
        the application status or determine eligibility.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <WorkflowItem
          title="Saved job analysis"
          state={workflow.analysis}
          icon={FileSearch}
          action={
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href={`/jobs/${jobId}`}>
                <BriefcaseBusiness className="size-3" aria-hidden />
                Open job
              </Link>
            </Button>
          }
        />
        <WorkflowItem
          title="Deterministic Profile Match"
          state={workflow.match}
          icon={Scale}
          action={
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href={`/jobs/${jobId}`}>Explain match</Link>
            </Button>
          }
        />
        <WorkflowItem
          title="Tailoring preflight"
          state={workflow.tailoring}
          icon={WandSparkles}
          action={
            workflow.tailoring === "analysis_required" ? undefined : (
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href={`/resumes/tailor/${jobId}`}>Review tailoring</Link>
              </Button>
            )
          }
        />
        <WorkflowItem
          title="Saved tailored resume"
          state={workflow.resume.status}
          icon={FileCheck2}
          action={
            workflow.resume.status === "ready" ? (
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href={`/resumes/versions/${workflow.resume.versionId}`}>
                  Open saved resume
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>
      {sourceUrl ? (
        <Button asChild variant="ghost" size="sm" className="h-8">
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Open source posting
          </a>
        </Button>
      ) : null}
    </div>
  );
}
