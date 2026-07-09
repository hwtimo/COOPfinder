"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  PencilLine,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MockTailoringSuggestion } from "@/lib/mock";
import { DiffText } from "./diff-text";
import { TrustBadge } from "./trust-badge";

interface SuggestionCardProps {
  suggestion: MockTailoringSuggestion;
  /** Index within the pending review flow, e.g. "Suggestion 2 of 5". */
  position: { index: number; total: number };
  /** The master-resume bullet backing this suggestion (null = unsupported). */
  evidence: { source: string; text: string } | null;
  onAccept: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
  onSaveEdit: (suggestionId: string, text: string) => void;
}

/* DESIGN.md §9.4 — every AI edit is reviewable: original, suggested,
   rationale, source evidence, trust label, and explicit accept/reject/edit. */
export function SuggestionCard({
  suggestion,
  position,
  evidence,
  onAccept,
  onReject,
  onSaveEdit,
}: SuggestionCardProps) {
  const [editing, setEditing] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [draft, setDraft] = useState(suggestion.after);
  const unsupported = suggestion.trustLabel === "Potential unsupported claim";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-l-2 bg-card",
        unsupported ? "border-l-destructive" : "border-l-brand",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
            Suggestion {position.index} of {position.total}
          </span>
          <TrustBadge label={suggestion.trustLabel} />
        </div>
        <button
          type="button"
          onClick={() => setShowEvidence((value) => !value)}
          className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={showEvidence}
        >
          {showEvidence ? (
            <ChevronUp className="size-3.5" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden />
          )}
          Source evidence
        </button>
      </div>

      {showEvidence ? (
        <div
          className={cn(
            "border-b px-4 py-3",
            evidence ? "bg-background" : "bg-destructive-soft",
          )}
        >
          {evidence ? (
            <>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                From your master profile · {evidence.source}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-text-secondary">
                “{evidence.text}”
              </p>
            </>
          ) : (
            <p className="text-sm leading-6 text-destructive">
              No matching entry in your master profile backs this suggestion.
            </p>
          )}
        </div>
      ) : null}

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Original
          </p>
          <p className="rounded-md bg-muted/60 px-3 py-2 text-sm leading-6 text-text-secondary">
            <DiffText
              text={suggestion.before}
              compareWith={suggestion.after}
              mode="removed"
            />
          </p>
        </div>

        <div className="grid gap-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-brand">
            Suggested
          </p>
          {editing ? (
            <div>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                autoFocus
                aria-label="Edit suggested bullet"
                className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-6 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Keep it factual — only claim work you actually did.
              </p>
            </div>
          ) : (
            <p className="rounded-md bg-brand-soft/40 px-3 py-2 text-sm leading-6 text-foreground">
              <DiffText
                text={suggestion.after}
                compareWith={suggestion.before}
                mode="added"
              />
            </p>
          )}
        </div>

        {suggestion.warning ? (
          <div
            className={cn(
              "flex gap-2 rounded-md px-3 py-2.5",
              unsupported ? "bg-destructive-soft" : "bg-warning-soft",
            )}
          >
            <AlertTriangle
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                unsupported ? "text-destructive" : "text-warning",
              )}
              aria-hidden
            />
            <p
              className={cn(
                "text-xs leading-5",
                unsupported ? "text-destructive" : "text-warning",
              )}
            >
              {suggestion.warning}
            </p>
          </div>
        ) : null}

        <p className="text-xs leading-5 text-muted-foreground">
          <span className="font-medium text-text-secondary">Why: </span>
          {suggestion.rationale}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button
                size="sm"
                className="h-8"
                onClick={() => {
                  onSaveEdit(suggestion.id, draft.trim());
                  setEditing(false);
                }}
                disabled={draft.trim().length === 0}
              >
                <Check className="size-3.5" aria-hidden />
                Save edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => {
                  setDraft(suggestion.after);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                className="h-8"
                variant={unsupported ? "outline" : "default"}
                onClick={() => onAccept(suggestion.id)}
              >
                <Check className="size-3.5" aria-hidden />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={cn("h-8", unsupported && "text-destructive")}
                onClick={() => onReject(suggestion.id)}
              >
                <X className="size-3.5" aria-hidden />
                Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setEditing(true)}
              >
                <PencilLine className="size-3.5" aria-hidden />
                Edit
              </Button>
            </>
          )}
        </div>
        {suggestion.addedKeywords.length > 0 && !editing ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {suggestion.addedKeywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary"
              >
                {keyword}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
