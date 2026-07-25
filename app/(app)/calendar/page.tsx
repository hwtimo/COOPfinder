import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Calendar tools are not available yet."
      />
      <EmptyState
        icon={Calendar}
        title="Calendar is not available yet"
        description="Manage application deadlines and follow-ups from Applications."
        actionLabel="Open Applications"
        onActionHref="/applications"
      />
    </div>
  );
}
