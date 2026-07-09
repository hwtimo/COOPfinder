import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="How your search is going — response rates, resume performance, activity."
      />
      <EmptyState
        icon={BarChart3}
        title="Not enough data yet"
        description="Apply to a few jobs first. Insights unlock once you have application activity to analyze."
        actionLabel="View saved jobs"
        onActionHref="/jobs"
      />
    </div>
  );
}
