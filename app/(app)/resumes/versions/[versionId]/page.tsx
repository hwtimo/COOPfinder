import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CardSection } from "@/components/app/card-section";
import { PageHeader } from "@/components/app/page-header";
import { ResumeVersionPrintButton } from "@/components/app/resume-version-print-button";
import { TailoredResumeReview } from "@/components/app/tailored-resume-review";
import { Button } from "@/components/ui/button";
import { getLoginHref } from "@/lib/auth/paths";
import { getOwnedTailoredResumeVersion } from "@/lib/tailoring/get-owned-tailored-resume-version";

type ResumeVersionPageProps = {
  params: Promise<{ versionId: string }>;
};

export default async function ResumeVersionPage({
  params,
}: ResumeVersionPageProps) {
  const { versionId } = await params;
  const result = await getOwnedTailoredResumeVersion(versionId);
  if (result.status === "unauthenticated") {
    redirect(getLoginHref(`/resumes/versions/${versionId}`));
  }
  if (result.status === "not_found") notFound();

  if (result.status === "ready") {
    const completeDocument = "identity" in result.review;
    return (
      <div className="space-y-6 print:space-y-0">
        <div className="print:hidden">
          <PageHeader
            title={result.versionName}
            description={
              completeDocument
                ? "Saved immutable tailored resume"
                : "Saved older tailoring record"
            }
            actions={
              completeDocument ? <ResumeVersionPrintButton /> : undefined
            }
          />
        </div>
        <TailoredResumeReview version={result} />
        <style>{`@media print {
          @page { size: letter; margin: 0.55in; }
          html, body { background: #fff !important; }
          .resume-print-surface { color: #0f172a !important; }
        }`}</style>
      </div>
    );
  }

  const copy = {
    legacy_content_unavailable: {
      title: "Older tailoring plan",
      message:
        "This saved record predates complete tailored-resume documents and cannot be printed as a resume.",
    },
    invalid_content: {
      title: "Saved version unavailable",
      message: "This saved version cannot be displayed safely.",
    },
    unavailable: {
      title: "Saved version temporarily unavailable",
      message: "The saved resume could not be loaded. Please try again.",
    },
  }[result.status];

  return (
    <CardSection title={copy.title}>
      <p className="text-sm leading-6 text-muted-foreground">{copy.message}</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href="/resumes">Back to resumes</Link>
      </Button>
    </CardSection>
  );
}
