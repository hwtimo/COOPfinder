import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BookUser, FileText, Upload } from "lucide-react";

import { CardSection } from "@/components/app/card-section";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { getLoginHref } from "@/lib/auth/paths";
import { formatPrivateJobDate } from "@/lib/jobs/dates";
import { getOwnedResumeVersionSummaries } from "@/lib/resumes/get-owned-resume-version-summaries";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getSupabaseUser } from "@/lib/supabase/user";

export const dynamic = "force-dynamic";

function ResumeHubHeader() {
  return (
    <PageHeader
      title="Resumes"
      description="Your Master Profile and saved tailored resume versions."
      actions={
        <>
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link href="/resumes/master">
              <BookUser className="size-3.5" aria-hidden />
              Master Profile
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled
            title="Resume upload is not implemented yet"
          >
            <Upload className="size-3.5" aria-hidden />
            Upload resume
          </Button>
        </>
      }
    />
  );
}

export default async function ResumesPage() {
  if (!getSupabaseEnv()) {
    return (
      <div className="space-y-6">
        <ResumeHubHeader />
        <EmptyState
          icon={AlertTriangle}
          title="Saved resumes unavailable"
          description="Supabase is not configured for this build. No saved resume data can be shown."
        />
      </div>
    );
  }

  const user = await getSupabaseUser();
  if (!user) redirect(getLoginHref("/resumes"));

  const result = await getOwnedResumeVersionSummaries(user.id);

  return (
    <div className="space-y-6">
      <ResumeHubHeader />

      {result.status === "unavailable" ? (
        <EmptyState
          icon={AlertTriangle}
          title="Saved resumes could not load"
          description="Your saved resume versions are temporarily unavailable. No fallback data is shown."
        />
      ) : result.versions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No saved resume versions yet"
          description="Build your Master Profile, then create a tailored resume from an analyzed private job."
          actionLabel="Open Master Profile"
          onActionHref="/resumes/master"
        />
      ) : (
        <CardSection
          title="Saved resume versions"
          description="Your persisted tailored resume records"
          contentClassName="p-0"
        >
          <ul className="divide-y">
            {result.versions.map((version) => (
              <li key={version.id}>
                <Link
                  href={`/resumes/versions/${version.id}`}
                  className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <FileText
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {version.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {version.jobTitle}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Saved {formatPrivateJobDate(version.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CardSection>
      )}
    </div>
  );
}
