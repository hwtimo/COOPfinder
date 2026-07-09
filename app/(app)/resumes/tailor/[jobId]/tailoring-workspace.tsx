"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookUser,
  CheckCircle2,
  Circle,
  CircleAlert,
  FileDown,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { CardSection } from "@/components/app/card-section";
import { DeadlineBadge, StatusBadge } from "@/components/app/status-badge";
import { DiffText } from "@/components/app/tailor/diff-text";
import { SuggestionCard } from "@/components/app/tailor/suggestion-card";
import {
  KeywordChecklist,
  type KeywordChecklistItem,
} from "@/components/app/tailor/keyword-checklist";
import { cn } from "@/lib/utils";
import {
  daysUntil,
  formatDeadline,
  type MockJob,
  type MockJobAnalysis,
  type MockMasterResume,
  type MockStudentProfile,
  type MockTailoringSession,
  type MockTailoringSuggestion,
} from "@/lib/mock";

interface TailoringWorkspaceProps {
  job: MockJob;
  analysis: MockJobAnalysis;
  session: MockTailoringSession;
  profile: MockStudentProfile;
  masterResume: MockMasterResume;
}

type SuggestionStatus = "pending" | "accepted" | "rejected";

interface SuggestionState {
  status: SuggestionStatus;
  text: string;
  editedByUser: boolean;
}

function matchTone(match: number | null) {
  if (match === null) return "text-text-secondary";
  if (match >= 80) return "text-success";
  if (match >= 70) return "text-info";
  if (match >= 50) return "text-warning";
  return "text-text-secondary";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function SkillPills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function TailoringWorkspace({
  job,
  analysis,
  session,
  profile,
  masterResume,
}: TailoringWorkspaceProps) {
  const suggestionById = useMemo(() => {
    const map = new Map<string, MockTailoringSuggestion>();
    for (const suggestion of session.suggestions) {
      map.set(suggestion.id, suggestion);
    }
    return map;
  }, [session.suggestions]);

  /** 1-based position of each suggestion in the review order. */
  const suggestionPosition = useMemo(() => {
    const map = new Map<string, number>();
    session.suggestions.forEach((suggestion, index) => {
      map.set(suggestion.id, index + 1);
    });
    return map;
  }, [session.suggestions]);

  const evidenceFor = (suggestion: MockTailoringSuggestion) => {
    if (!suggestion.sourceBulletId) return null;
    const bullet = masterResume.bullets.find(
      (item) => item.id === suggestion.sourceBulletId,
    );
    return bullet ? { source: bullet.source, text: bullet.text } : null;
  };

  const [states, setStates] = useState<Record<string, SuggestionState>>(() =>
    Object.fromEntries(
      session.suggestions.map((suggestion) => [
        suggestion.id,
        { status: "pending" as const, text: suggestion.after, editedByUser: false },
      ]),
    ),
  );
  const [versionSaved, setVersionSaved] = useState(false);
  const [markedReady, setMarkedReady] = useState(false);

  const accept = (id: string) =>
    setStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: "accepted" },
    }));

  const reject = (id: string) =>
    setStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: "rejected" },
    }));

  const saveEdit = (id: string, text: string) =>
    setStates((prev) => ({
      ...prev,
      [id]: { status: "accepted", text, editedByUser: true },
    }));

  const undo = (id: string) => {
    const suggestion = suggestionById.get(id);
    if (!suggestion) return;
    setStates((prev) => ({
      ...prev,
      [id]: { status: "pending", text: suggestion.after, editedByUser: false },
    }));
    setMarkedReady(false);
  };

  const total = session.suggestions.length;
  const pendingIds = session.suggestions
    .filter((suggestion) => states[suggestion.id]?.status === "pending")
    .map((suggestion) => suggestion.id);
  const reviewed = total - pendingIds.length;
  const allReviewed = pendingIds.length === 0;

  const scrollToNextPending = () => {
    const target = document.getElementById(`suggestion-${pendingIds[0]}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const unsupportedAccepted = session.suggestions.some(
    (suggestion) =>
      suggestion.trustLabel === "Potential unsupported claim" &&
      states[suggestion.id]?.status === "accepted" &&
      !states[suggestion.id]?.editedByUser,
  );

  const keywordItems: KeywordChecklistItem[] = session.keywords.map((item) => {
    const coveredByAccepted = item.coveredBySuggestionIds?.some(
      (id) => states[id]?.status === "accepted",
    );
    return {
      id: item.id,
      keyword: item.keyword,
      status: coveredByAccepted ? "covered" : item.baseStatus,
      source: coveredByAccepted
        ? `${item.source} · via accepted suggestion`
        : item.source,
    };
  });
  const coveredCount = keywordItems.filter(
    (item) => item.status === "covered",
  ).length;

  const readiness = [
    {
      id: "r-reviewed",
      label: "All AI suggestions reviewed",
      detail: `${reviewed} of ${total} reviewed`,
      done: allReviewed,
      tone: "default" as const,
    },
    {
      id: "r-unsupported",
      label: "No unsupported claims accepted",
      detail: unsupportedAccepted
        ? "An unsupported suggestion was accepted as-is"
        : "Nothing unsupported in the draft",
      done: !unsupportedAccepted,
      tone: unsupportedAccepted ? ("danger" as const) : ("default" as const),
    },
    {
      id: "r-keywords",
      label: "Job keywords covered",
      detail: `${coveredCount} of ${keywordItems.length} covered`,
      done: coveredCount === keywordItems.length,
      tone: "default" as const,
    },
    {
      id: "r-saved",
      label: "Version saved",
      detail: versionSaved ? "Saved to resume versions" : "Not saved yet",
      done: versionSaved,
      tone: "default" as const,
    },
  ];

  const canMarkReady = allReviewed && !unsupportedAccepted;

  return (
    <div className="space-y-6">
      <Link
        href={`/jobs/${job.id}`}
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to job detail
      </Link>

      <PageHeader
        title="Tailor resume"
        description={`${session.versionName} · based on ${session.baseVersionName} · for ${job.company} — ${job.role}`}
        actions={
          <Button variant="outline" size="sm" asChild className="h-9">
            <Link href="/resumes/master">
              <BookUser className="size-4" aria-hidden />
              Master profile
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---------- Center: the tailored draft is the star ---------- */}
        <div className="min-w-0">
          <section className="rounded-lg border bg-card">
            {/* Review progress bar — guides one-by-one review */}
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">
                  Tailored resume draft
                </h2>
                <p
                  className="mt-0.5 text-xs text-muted-foreground tabular-nums"
                  aria-live="polite"
                >
                  {reviewed} of {total} suggestions reviewed
                  {allReviewed ? " — all done" : ""}
                </p>
              </div>
              {!allReviewed ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={scrollToNextPending}
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                  Next suggestion
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Review complete
                </span>
              )}
            </header>

            {/* Document-style draft */}
            <div className="px-6 py-6 sm:px-8">
              {/* Resume header */}
              <div className="border-b pb-5 text-center">
                <p className="text-xl font-semibold tracking-tight text-foreground">
                  {profile.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {profile.email} · {profile.phone} · {profile.location}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Simon Fraser University · {profile.program} · {profile.year}
                </p>
              </div>

              <div className="mt-6 space-y-8">
                {session.sections.map((section) => (
                  <div key={section.id}>
                    <h3 className="border-b pb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                      {section.heading}
                    </h3>
                    <div className="mt-4 space-y-5">
                      {section.entries.map((entry) => (
                        <div key={entry.id}>
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="text-sm font-semibold text-foreground">
                              {entry.title}
                            </p>
                            {entry.subtitle ? (
                              <p className="text-xs text-muted-foreground">
                                {entry.subtitle}
                              </p>
                            ) : null}
                          </div>
                          <ul className="mt-2 space-y-3">
                            {entry.bullets.map((bullet) => {
                              const suggestion = bullet.suggestionId
                                ? suggestionById.get(bullet.suggestionId)
                                : undefined;
                              const state = suggestion
                                ? states[suggestion.id]
                                : undefined;

                              /* Plain bullet — no AI involvement */
                              if (!suggestion || !state) {
                                return (
                                  <li
                                    key={bullet.id}
                                    className="flex gap-2.5 text-sm leading-6 text-text-secondary"
                                  >
                                    <span
                                      className="mt-2.5 size-1 shrink-0 rounded-full bg-muted-foreground"
                                      aria-hidden
                                    />
                                    {bullet.text}
                                  </li>
                                );
                              }

                              /* Pending — full review card */
                              if (state.status === "pending") {
                                return (
                                  <li
                                    key={bullet.id}
                                    id={`suggestion-${suggestion.id}`}
                                    className="scroll-mt-24"
                                  >
                                    <SuggestionCard
                                      suggestion={suggestion}
                                      position={{
                                        index:
                                          suggestionPosition.get(
                                            suggestion.id,
                                          ) ?? 0,
                                        total,
                                      }}
                                      evidence={evidenceFor(suggestion)}
                                      onAccept={accept}
                                      onReject={reject}
                                      onSaveEdit={saveEdit}
                                    />
                                  </li>
                                );
                              }

                              /* Resolved — compact bullet with audit chip */
                              const accepted = state.status === "accepted";
                              return (
                                <li
                                  key={bullet.id}
                                  className="text-sm leading-6"
                                >
                                  <div className="flex gap-2.5">
                                    <span
                                      className="mt-2.5 size-1 shrink-0 rounded-full bg-muted-foreground"
                                      aria-hidden
                                    />
                                    <span
                                      className={
                                        accepted
                                          ? "text-foreground"
                                          : "text-text-secondary"
                                      }
                                    >
                                      {accepted ? (
                                        state.editedByUser ? (
                                          state.text
                                        ) : (
                                          <DiffText
                                            text={state.text}
                                            compareWith={suggestion.before}
                                            mode="added"
                                          />
                                        )
                                      ) : (
                                        suggestion.before
                                      )}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 pl-3.5">
                                    {accepted ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                                        <CheckCircle2
                                          className="size-3"
                                          aria-hidden
                                        />
                                        Accepted ·{" "}
                                        {state.editedByUser
                                          ? "Edited by you"
                                          : suggestion.trustLabel}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                        <X className="size-3" aria-hidden />
                                        Rejected · original kept
                                      </span>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-[11px] text-muted-foreground"
                                      onClick={() => undo(suggestion.id)}
                                    >
                                      <RotateCcw
                                        className="size-3"
                                        aria-hidden
                                      />
                                      Undo
                                    </Button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ---------- Right: job context + review rail ---------- */}
        <aside className="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:self-start xl:overflow-y-auto xl:pb-4">
          <CardSection
            title={job.role}
            description={`${job.company} · ${job.location} · ${job.term}`}
            contentClassName="space-y-4 p-5"
            action={
              <DeadlineBadge
                daysLeft={daysUntil(job.deadline)}
                label={formatDeadline(job.deadline)}
              />
            }
          >
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Estimated match
              </p>
              <p
                className={cn(
                  "mt-1 text-3xl font-medium leading-none tabular-nums",
                  matchTone(job.match),
                )}
              >
                {job.match === null ? "Not analyzed" : `${job.match}%`}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Directional signal only — not a hiring prediction.
              </p>
            </div>
            <div className="space-y-2">
              <SectionLabel>Application status</SectionLabel>
              <StatusBadge status={markedReady ? "ready" : job.status} />
              {markedReady ? (
                <p className="text-xs text-muted-foreground">
                  Local mock status updated. Open the tracker to continue.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <SectionLabel>Required skills</SectionLabel>
              <SkillPills items={analysis.requiredSkills} />
            </div>
            <div className="space-y-2">
              <SectionLabel>Nice to have</SectionLabel>
              <SkillPills items={analysis.niceToHaveSkills} />
            </div>
          </CardSection>

          <CardSection
            title="Keyword coverage"
            description={`${coveredCount} of ${keywordItems.length} covered · updates as you accept`}
          >
            <KeywordChecklist items={keywordItems} />
          </CardSection>

          <CardSection
            title="Readiness"
            description="Checks before you export or apply"
            contentClassName="space-y-3 p-5"
          >
            <ul className="space-y-2.5">
              {readiness.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5">
                  {item.done ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden
                    />
                  ) : item.tone === "danger" ? (
                    <CircleAlert
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                      aria-hidden
                    />
                  ) : (
                    <Circle
                      className="mt-0.5 size-4 shrink-0 text-border-strong"
                      aria-hidden
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        item.tone === "danger"
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardSection>

          <CardSection title="Actions" contentClassName="space-y-2 p-5">
            <Button
              className="h-9 w-full"
              onClick={() => setVersionSaved(true)}
              disabled={versionSaved}
            >
              <Save className="size-4" aria-hidden />
              {versionSaved ? "Version saved" : "Save version"}
            </Button>
            {markedReady ? (
              <Button
                asChild
                variant="outline"
                className="h-9 w-full"
              >
                <Link href="/applications">
                  <ArrowRight className="size-4" aria-hidden />
                  Open application tracker
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-9 w-full"
                disabled={!canMarkReady}
                onClick={() => setMarkedReady(true)}
                title={
                  canMarkReady
                    ? undefined
                    : "Review all suggestions first — unsupported claims must be resolved"
                }
              >
                <BadgeCheck className="size-4" aria-hidden />
                Mark as ready to apply
              </Button>
            )}
            {!canMarkReady ? (
              <p className="text-xs text-muted-foreground">
                Review every suggestion (and resolve unsupported claims) to
                mark this version ready.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" className="h-9" disabled>
                <FileDown className="size-4" aria-hidden />
                Export PDF
              </Button>
              <Button variant="outline" className="h-9" disabled>
                <FileDown className="size-4" aria-hidden />
                Export DOCX
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Review before exporting. Export is enabled once file generation
              is connected.
            </p>
          </CardSection>
        </aside>
      </div>
    </div>
  );
}
