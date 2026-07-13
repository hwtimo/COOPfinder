import { ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";

export default function ApplicationNotFound() {
  return (
    <EmptyState
      icon={ClipboardList}
      title="Application not found"
      description="This application does not exist or is not owned by your account. No other user's application was shown."
      actionLabel="Return to applications"
      onActionHref="/applications"
    />
  );
}
