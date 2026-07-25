import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="Insights are not available yet."
      />
      <EmptyState
        icon={BarChart3}
        title="Insights are not available yet"
        description="Review your saved jobs and explainable Profile Match details in My Jobs."
        actionLabel="Open My Jobs"
        onActionHref="/jobs"
      />
    </div>
  );
}
