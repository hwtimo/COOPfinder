import { Folder } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Cover letters, transcripts, and exported resume PDFs."
      />
      <EmptyState
        icon={Folder}
        title="No documents yet"
        description="Exported resumes and cover letters will be stored here for quick reuse."
        actionLabel="View resumes"
        onActionHref="/resumes"
      />
    </div>
  );
}
