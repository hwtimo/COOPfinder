"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";

import {
  importResumeProfileDraftAction,
  type ResumeProfileDraftImportState,
} from "@/app/(app)/resumes/actions";
import { Button } from "@/components/ui/button";
import type { ResumeProfileDraftV1 } from "@/lib/resumes/resume-profile-draft-contract";

const initialState: ResumeProfileDraftImportState = {
  status: "idle",
  message: "",
};

export function ResumeProfileDraftImportForm({
  draft,
}: {
  draft: ResumeProfileDraftV1;
}) {
  const [state, formAction, pending] = useActionState(
    importResumeProfileDraftAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2 border-t border-border pt-4">
      <input type="hidden" name="draft" value={JSON.stringify(draft)} />
      <Button type="submit" disabled={pending} className="gap-1.5">
        {pending ? "Importing draft..." : "Import draft for review"}
        <ArrowRight aria-hidden />
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Imported items stay unconfirmed. Review and confirm them individually
        in your Master Profile.
      </p>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
