import Link from "next/link";
import { BookUser, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function ResumesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumes"
        description="Your master resume and tailored versions."
        actions={
          <>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <Link href="/resumes/master">
                <BookUser className="size-3.5" aria-hidden />
                Master profile
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Upload className="size-3.5" aria-hidden />
              Upload resume
            </Button>
          </>
        }
      />
      <EmptyState
        icon={FileText}
        title="No resume uploaded"
        description="Upload your master resume so AI can suggest role-specific edits based only on your real experience."
        actionLabel="Upload resume"
      />
    </div>
  );
}
