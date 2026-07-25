"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useActionState } from "react";

import {
  deleteAccountAction,
  INITIAL_DELETE_ACCOUNT_STATE,
} from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCOUNT_DELETE_CONFIRMATION } from "@/lib/account/delete-current-account";

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    INITIAL_DELETE_ACCOUNT_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive-soft p-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm leading-6 text-foreground">
          This permanently deletes your account and all private InternshipBC
          data associated with it. This action cannot be undone.
        </p>
      </div>
      <label htmlFor="delete-account-confirmation" className="grid gap-1.5">
        <span className="text-xs font-medium text-foreground">
          Type {ACCOUNT_DELETE_CONFIRMATION} to confirm
        </span>
        <Input
          id="delete-account-confirmation"
          name="confirmation"
          required
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          aria-invalid={state.status !== "idle"}
          className="h-10"
        />
      </label>
      {state.status !== "idle" ? (
        <p role="alert" className="rounded-md border border-destructive/20 bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="destructive" className="h-9 rounded-md" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
        {pending ? "Deleting account..." : "Delete account permanently"}
      </Button>
    </form>
  );
}
