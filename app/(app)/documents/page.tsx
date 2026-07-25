import { Folder } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Document management is not available yet."
      />
      <EmptyState
        icon={Folder}
        title="Documents are not available yet"
        description="Use Resumes to manage your Master Profile and saved resume versions."
        actionLabel="Open Resumes"
        onActionHref="/resumes"
      />
    </div>
  );
}
