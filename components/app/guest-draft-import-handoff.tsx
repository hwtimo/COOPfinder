"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { importGuestDraftAction } from "@/app/(app)/resumes/master/actions";
import { Button } from "@/components/ui/button";
import { guestDraftHasValue } from "@/lib/guest-draft/normalize";
import { loadGuestDraft, removeGuestDraft } from "@/lib/guest-draft/storage";
import type { GuestDraftV1 } from "@/lib/guest-draft/types";
import { INITIAL_GUEST_IMPORT_STATE } from "@/lib/master-profile/types";

const DISMISS_KEY_PREFIX = "coopfinder.guest_import.dismissed";

export function GuestDraftImportHandoff({ userId }: { userId: string }) {
  const [draft, setDraft] = useState<GuestDraftV1 | null>(null);
  const [malformed, setMalformed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [cleared, setCleared] = useState(false);
  const attemptedDraft = useRef<string | null>(null);
  const [state, importAction, pending] = useActionState(
    importGuestDraftAction,
    INITIAL_GUEST_IMPORT_STATE,
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const result = loadGuestDraft();
      if (result.recoveredFromInvalidData) {
        setMalformed(true);
        return;
      }
      if (!result.storageAvailable || !guestDraftHasValue(result.draft)) return;

      const dismissalKey = `${DISMISS_KEY_PREFIX}.${userId}.${result.draft.updatedAt}`;
      try {
        if (window.sessionStorage.getItem(dismissalKey) === "yes") {
          setDismissed(true);
          return;
        }
      } catch {
        // Session-only dismissal is optional; import idempotency remains server-side.
      }

      setDraft(result.draft);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [userId]);

  useEffect(() => {
    if (!draft || dismissed || attemptedDraft.current === draft.updatedAt) return;
    attemptedDraft.current = draft.updatedAt;
    startTransition(() => importAction({ mode: "auto", draft }));
  }, [dismissed, draft, importAction]);

  useEffect(() => {
    if (
      !draft ||
      !state.complete ||
      !state.draftHash ||
      state.normalizedUpdatedAt !== draft.updatedAt ||
      (state.status !== "imported" && state.status !== "already_imported")
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const result = removeGuestDraft();
      if (result.ok) setCleared(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [draft, state]);

  if (dismissed || (!draft && !malformed)) return null;

  if (malformed) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-md border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Device draft needs review</p>
          <p className="mt-0.5 text-xs leading-5 text-text-secondary">
            The saved guest draft is malformed. No server writes were made and the local data was not cleared.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "imported" || state.status === "already_imported") {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-md border border-success/25 bg-success-soft px-4 py-3 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Device draft imported</p>
          <p className="mt-0.5 text-xs leading-5 text-text-secondary">
            {state.message} {cleared ? "The device copy was cleared." : "The device copy could not be cleared automatically."}
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "needs_confirmation") {
    return (
      <div className="mb-4 rounded-md border bg-card px-4 py-3">
        <p className="text-sm font-medium text-foreground">Import your device draft?</p>
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          This account already has saved data. Importing fills empty profile fields and adds only non-duplicate skills, entries, and jobs.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-8 rounded-md"
            disabled={pending}
            onClick={() => {
              if (!draft) return;
              startTransition(() => importAction({ mode: "merge", draft }));
            }}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Import guest draft
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-md"
            disabled={pending}
            onClick={() => {
              if (draft) {
                try {
                  window.sessionStorage.setItem(
                    `${DISMISS_KEY_PREFIX}.${userId}.${draft.updatedAt}`,
                    "yes",
                  );
                } catch {
                  // The current render can still be dismissed safely.
                }
              }
              setDismissed(true);
            }}
          >
            Keep current account data
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-md text-muted-foreground"
            disabled={pending}
            onClick={() => {
              if (removeGuestDraft().ok) setDismissed(true);
            }}
          >
            Remove device draft
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border bg-card px-4 py-3 text-sm">
      {pending ? (
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-brand" aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      )}
      <div>
        <p className="font-medium text-foreground">
          {pending ? "Importing your device draft" : "Device draft was not imported"}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-text-secondary">
          {pending
            ? "Your profile, evidence, and saved job intake are being checked before anything is stored."
            : state.message}
        </p>
      </div>
    </div>
  );
}
