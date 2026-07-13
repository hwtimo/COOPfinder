import { BriefcaseBusiness } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";

export default function BoardJobNotFound() {
  return (
    <EmptyState
      icon={BriefcaseBusiness}
      title="This reviewed role is not available"
      description="It may be missing, awaiting review, inactive, archived, or past its deadline. Only approved current roles are public."
      actionLabel="Return to job board"
      onActionHref="/board"
    />
  );
}
