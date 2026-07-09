import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Deadlines, interviews, and follow-ups in one view."
      />
      <EmptyState
        icon={Calendar}
        title="Nothing scheduled"
        description="Deadlines and interviews from your applications will show up here automatically."
        actionLabel="View applications"
        onActionHref="/applications"
      />
    </div>
  );
}
