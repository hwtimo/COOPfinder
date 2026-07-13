import { Briefcase } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";

export default function PrivateJobNotFound() {
  return (
    <EmptyState
      icon={Briefcase}
      title="Private job not found"
      description="This saved job does not exist or is not owned by your account. No other user's private job was shown."
      actionLabel="Return to jobs"
      onActionHref="/jobs"
    />
  );
}
