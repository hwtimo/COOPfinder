import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  FileText,
  PencilLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { CardSection } from "@/components/app/card-section";
import { StatusBadge, DeadlineBadge } from "@/components/app/status-badge";
import { cn } from "@/lib/utils";
import {
  daysUntil,
  formatDeadline,
  mockJobAnalyses,
  mockJobs,
  type MockJob,
  type MockJobAnalysis,
} from "@/lib/mock";

type JobDetailPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return mockJobs.map((job) => ({ id: job.id }));
}

function fallbackAnalysis(job: MockJob): MockJobAnalysis {
  return {
    aiSummary:
      `${job.company} is looking for a student to contribute to ${job.role.toLowerCase()} work in ${job.location}. The posting should be reviewed against the student's existing projects before tailoring a resume.`,
    responsibilities: [
      `Contribute to ${job.role.toLowerCase()} tasks with the team.`,
      "Communicate progress clearly during the co-op term.",
      "Document implementation notes and application follow-up items.",
    ],
    requirements: [
      "Active enrollment in a Canadian co-op or internship program.",
      `Interest or experience in ${job.roleType.toLowerCase()} work.`,
      "Ability to work within the listed schedule and location expectations.",
    ],
    keywords: [job.roleType, job.workMode, job.term, job.location],
    requiredSkills: [job.roleType, "Communication", "Git"],
    niceToHaveSkills: ["Testing", "Documentation", "Team collaboration"],
    missingKeywords: ["Role-specific tooling", "Measured impact"],
    workAuthorizationNotes:
      `${job.workAuthorization}. Confirm the original posting before applying.`,
    coopTermFit: `${job.term} is listed on the posting. Check that it fits SFU co-op approval requirements.`,
    resumeSuggestions: [
      "Review the job description before exporting any tailored resume.",
      "Use only experience already present in the master resume.",
      "Add missing keywords only when they are supported by real projects or coursework.",
    ],
    suggestedResumeVersion: job.resumeVersion ?? `${job.roleType} draft`,
  };
}

function matchTone(match: number | null) {
  if (match === null) return "text-text-secondary";
  if (match >= 80) return "text-success";
  if (match >= 70) return "text-info";
  if (match >= 50) return "text-warning";
  return "text-text-secondary";
}

function TrustLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand">
      {children}
    </span>
  );
}

function MutedPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
      {children}
    </span>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm text-text-secondary">
          <span
            className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground"
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function KeywordList({
  items,
  tone = "neutral",
}: {
  items: string[];
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
            tone === "warning"
              ? "bg-warning-soft text-warning"
              : "bg-muted text-text-secondary",
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function AnalysisBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3">
        <BulletList items={items} />
      </div>
    </div>
  );
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  const job = mockJobs.find((item) => item.id === id);

  if (!job) {
    notFound();
  }

  const analysis = mockJobAnalyses[job.id] ?? fallbackAnalysis(job);
  const matchLabel = job.match === null ? "Not analyzed" : `${job.match}%`;

  return (
    <div className="space-y-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to jobs
      </Link>

      <PageHeader
        title={job.role}
        description={`${job.company} · ${job.location}`}
        actions={<StatusBadge status={job.status} />}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <TrustLabel>AI analysis from job description</TrustLabel>
                  <TrustLabel>Review before applying</TrustLabel>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">
                  {job.company}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                  {job.description}
                </p>
              </div>
              <DeadlineBadge
                daysLeft={daysUntil(job.deadline)}
                label={formatDeadline(job.deadline)}
              />
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Location">{job.location}</DetailItem>
              <DetailItem label="Term">{job.term}</DetailItem>
              <DetailItem label="Work mode">{job.workMode}</DetailItem>
              <DetailItem label="Deadline">
                {formatDeadline(job.deadline)}
              </DetailItem>
            </dl>
          </section>

          <CardSection
            title="Job description summary"
            description="A concise read of what the posting is asking for"
            action={<TrustLabel>AI analysis from job description</TrustLabel>}
          >
            <p className="text-sm leading-6 text-text-secondary">
              {analysis.aiSummary}
            </p>
          </CardSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <CardSection title="Responsibilities">
              <BulletList items={analysis.responsibilities} />
            </CardSection>

            <CardSection title="Requirements">
              <BulletList items={analysis.requirements} />
            </CardSection>
          </div>

          <CardSection
            title="Keywords"
            description="Use only when supported by your real experience"
            action={<TrustLabel>Based on your existing resume</TrustLabel>}
          >
            <KeywordList items={analysis.keywords} />
          </CardSection>

          <CardSection
            title="AI analysis"
            description="Reviewable guidance, not an application decision"
            action={<TrustLabel>Review before applying</TrustLabel>}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <AnalysisBlock
                title="Required skills"
                items={analysis.requiredSkills}
              />
              <AnalysisBlock
                title="Nice-to-have skills"
                items={analysis.niceToHaveSkills}
              />
              <div className="rounded-md border bg-background p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Work authorization notes
                </h3>
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  {analysis.workAuthorizationNotes}
                </p>
              </div>
              <div className="rounded-md border bg-background p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Co-op term fit
                </h3>
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  {analysis.coopTermFit}
                </p>
              </div>
            </div>
          </CardSection>

          <CardSection
            title="Resume suggestions"
            description="Based on your existing resume"
            action={<TrustLabel>Based on your existing resume</TrustLabel>}
          >
            <BulletList items={analysis.resumeSuggestions} />
          </CardSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <CardSection title="Decision panel" description="Next best action">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Estimated match
                </p>
                <p
                  className={cn(
                    "mt-2 text-4xl font-medium leading-none tabular-nums",
                    matchTone(job.match),
                  )}
                >
                  {matchLabel}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Directional signal only. Review before applying.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Missing keywords
                </p>
                <KeywordList items={analysis.missingKeywords} tone="warning" />
              </div>

              <dl className="space-y-3">
                <div className="rounded-md border bg-background p-3">
                  <dt className="text-xs text-muted-foreground">
                    Suggested resume version
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">
                    {analysis.suggestedResumeVersion}
                  </dd>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <dt className="text-xs text-muted-foreground">
                    Application status
                  </dt>
                  <dd className="mt-2">
                    <StatusBadge status={job.status} />
                  </dd>
                </div>
              </dl>

              <Button asChild className="h-9 w-full rounded-md">
                <Link href={`/resumes/tailor/${job.id}`}>
                  <FileText className="size-4" aria-hidden />
                  Tailor resume
                </Link>
              </Button>

              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 justify-start rounded-md"
                >
                  <CheckCircle2 className="size-4" aria-hidden />
                  Mark as ready
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 justify-start rounded-md"
                >
                  <CalendarPlus className="size-4" aria-hidden />
                  Add deadline
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 justify-start rounded-md"
                >
                  <PencilLine className="size-4" aria-hidden />
                  Save notes
                </Button>
              </div>
            </div>
          </CardSection>

          <CardSection title="Posting details" contentClassName="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Source</p>
              <a
                href={job.sourceUrl}
                className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Original posting
                <ArrowRight className="size-3" aria-hidden />
              </a>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Work authorization</p>
              <p className="mt-1 text-sm text-text-secondary">
                {job.workAuthorization}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saved note</p>
              <p className="mt-1 text-sm leading-5 text-text-secondary">
                {job.notes}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <MutedPill>{job.roleType}</MutedPill>
              <MutedPill>{job.workMode}</MutedPill>
              <MutedPill>
                {job.coopEligible ? "Co-op eligible" : "Check co-op"}
              </MutedPill>
            </div>
          </CardSection>
        </aside>
      </div>
    </div>
  );
}
