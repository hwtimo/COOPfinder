"use client";

import Link from "next/link";
import {
  AlignLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ExternalLink,
  HardDrive,
  Link2,
  LockKeyhole,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLoginHref } from "@/lib/auth/paths";
import {
  createStashedGuestJob,
  loadGuestDraft,
  saveGuestDraft,
  saveIntakeIntent,
} from "@/lib/guest-draft/storage";
import {
  createEmptyGuestDraft,
  createLocalId,
  SCHOOL_OPTIONS,
  WORK_AUTHORIZATION_OPTIONS,
  type GuestDraftEntry,
  type GuestDraftProfile,
  type GuestDraftV1,
  type JobIntakeType,
} from "@/lib/guest-draft/types";
import { publicStarterJobs } from "@/lib/mock/board-jobs";
import { rankStarterJobs } from "@/lib/start/matching";
import { cn } from "@/lib/utils";

const DESCRIPTION_LIMIT = 12_000;
const DESCRIPTION_MINIMUM = 40;

const TERM_OPTIONS = [
  "Fall 2026 · 4 months",
  "Fall 2026 · 8 months",
  "Winter 2027 · 4 months",
  "Winter 2027 · 8 months",
  "Summer 2027 · 4 months",
];

const TARGET_ROLE_OPTIONS = [
  "Software engineering",
  "Embedded systems",
  "Data and analytics",
  "Cloud and platform",
  "Full-stack development",
  "QA and test automation",
];

type StorageStatus = "loading" | "available" | "unavailable" | "recovered";

type StartOnboardingProps = {
  isAuthenticated: boolean;
};

function validateIntake(
  inputType: JobIntakeType,
  rawValue: string,
): { value?: string; error?: string } {
  const value = rawValue.trim();

  if (inputType === "url") {
    if (!value) return { error: "Paste a job link to save it." };
    if (value.length > 2_048) return { error: "That link is too long." };

    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { error: "Use an HTTP or HTTPS job link." };
      }
      return { value: url.toString() };
    } catch {
      return { error: "Enter a complete HTTP or HTTPS job link." };
    }
  }

  if (value.length < DESCRIPTION_MINIMUM) {
    return {
      error: `Add at least ${DESCRIPTION_MINIMUM} characters from the posting so it can be reviewed later.`,
    };
  }
  if (value.length > DESCRIPTION_LIMIT) {
    return {
      error: `Keep the description under ${DESCRIPTION_LIMIT.toLocaleString()} characters.`,
    };
  }

  return { value };
}

function hasMeaningfulProfile(draft: GuestDraftV1): boolean {
  const profile = draft.profile;

  return Boolean(
    profile.school ||
      (profile.program && profile.program.trim().length >= 2) ||
      profile.coopTerm ||
      profile.workAuthorization ||
      profile.targetRoles?.length ||
      draft.skills.length ||
      draft.entries.length,
  );
}

function formatStashedJob(job: GuestDraftV1["stashedJobs"][number]): string {
  if (job.inputType === "url" && job.url) {
    try {
      return new URL(job.url).hostname.replace(/^www\./, "");
    } catch {
      return "Saved job link";
    }
  }

  const text = job.text?.replace(/\s+/g, " ").trim() ?? "";
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

function TagInput({
  id,
  label,
  tags,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  tags: string[];
  placeholder: string;
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addValues(rawValues: string[]) {
    const existing = new Set(tags.map((tag) => tag.toLocaleLowerCase()));
    const next = [...tags];

    rawValues.forEach((rawValue) => {
      const value = rawValue.trim().slice(0, 80);
      const key = value.toLocaleLowerCase();
      if (value && !existing.has(key)) {
        existing.add(key);
        next.push(value);
      }
    });

    onChange(next.slice(0, 60));
  }

  function commitInput() {
    if (!input.trim()) return;
    addValues([input]);
    setInput("");
  }

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="mt-1.5 rounded-md border border-input bg-background p-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50">
        {tags.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-foreground"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onChange(tags.filter((item) => item !== tag))}
                  className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          id={id}
          value={input}
          onChange={(event) => {
            const value = event.target.value;
            if (value.includes(",")) {
              const parts = value.split(",");
              addValues(parts.slice(0, -1));
              setInput(parts.at(-1) ?? "");
            } else {
              setInput(value);
            }
          }}
          onBlur={commitInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitInput();
            }
          }}
          placeholder={placeholder}
          className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Press Enter or use a comma to add each skill.
      </p>
    </div>
  );
}

function EntryComposer({ onAdd }: { onAdd: (entry: GuestDraftEntry) => void }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<"experience" | "project">("project");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [skills, setSkills] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setOpen(false);
    setSection("project");
    setTitle("");
    setText("");
    setSkills("");
    setError("");
  }

  function addEntry() {
    const cleanTitle = title.trim();
    const cleanText = text.trim();
    if (!cleanTitle || !cleanText) {
      setError("Add a title and a short description.");
      return;
    }

    onAdd({
      id: createLocalId("entry"),
      section,
      title: cleanTitle.slice(0, 160),
      text: cleanText.slice(0, 2_000),
      skills: skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
        .slice(0, 30),
    });
    reset();
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-9 rounded-md"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5" aria-hidden />
        Add experience or project
      </Button>
    );
  }

  return (
    <div className="rounded-md border bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-foreground">
          Entry type
          <select
            value={section}
            onChange={(event) =>
              setSection(event.target.value as "experience" | "project")
            }
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
          >
            <option value="project">Project</option>
            <option value="experience">Experience</option>
          </select>
        </label>
        <label className="text-xs font-medium text-foreground">
          Title
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Robotics club software lead"
            className="mt-1.5 h-10 rounded-md bg-card text-sm"
            maxLength={160}
          />
        </label>
      </div>
      <label className="mt-3 block text-xs font-medium text-foreground">
        What did you do?
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Built a sensor dashboard and documented integration tests for the student team."
          className="mt-1.5 min-h-24 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring/50"
          maxLength={2_000}
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-foreground">
        Skills used
        <Input
          value={skills}
          onChange={(event) => setSkills(event.target.value)}
          placeholder="TypeScript, React, Git"
          className="mt-1.5 h-10 rounded-md bg-card text-sm"
        />
      </label>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="button" className="h-9 rounded-md" onClick={addEntry}>
          Add to draft
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-md"
          onClick={reset}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function StartOnboarding({ isAuthenticated }: StartOnboardingProps) {
  const [draft, setDraft] = useState<GuestDraftV1>(() =>
    createEmptyGuestDraft(),
  );
  const [storageStatus, setStorageStatus] =
    useState<StorageStatus>("loading");
  const [hydrated, setHydrated] = useState(false);
  const [intakeType, setIntakeType] = useState<JobIntakeType>("url");
  const [intakeValue, setIntakeValue] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [intakeSaved, setIntakeSaved] = useState(false);

  useEffect(() => {
    const result = loadGuestDraft();
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setDraft(result.draft);
      setStorageStatus(
        result.storageAvailable
          ? result.recoveredFromInvalidData
            ? "recovered"
            : "available"
          : "unavailable",
      );
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const result = saveGuestDraft(draft);
    if (!result.ok) {
      queueMicrotask(() => setStorageStatus("unavailable"));
    }
  }, [draft, hydrated]);

  const matches = useMemo(
    () => rankStarterJobs(draft, publicStarterJobs),
    [draft],
  );
  const hasValue =
    draft.stashedJobs.length > 0 ||
    hasMeaningfulProfile(draft) ||
    matches.length > 0;
  const loginHref = getLoginHref(
    draft.stashedJobs.length > 0 ? "/jobs" : "/dashboard",
    draft.stashedJobs.length > 0 ? "extract_job" : "save_progress",
  );

  function updateDraft(updater: (current: GuestDraftV1) => GuestDraftV1) {
    setDraft((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateProfile<Key extends keyof GuestDraftProfile>(
    key: Key,
    value: GuestDraftProfile[Key],
  ) {
    updateDraft((current) => {
      const profile = { ...current.profile };
      if (
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete profile[key];
      } else {
        profile[key] = value;
      }
      return { ...current, profile };
    });
  }

  function submitIntake() {
    setIntakeError("");
    setIntakeSaved(false);
    const validation = validateIntake(intakeType, intakeValue);
    if (!validation.value) {
      setIntakeError(validation.error ?? "Check the posting and try again.");
      return;
    }

    if (isAuthenticated) {
      const result = saveIntakeIntent(intakeType, validation.value);
      if (!result.ok) {
        setIntakeError(
          "This browser could not prepare the private handoff. Check browser storage settings and try again.",
        );
        return;
      }

      window.location.assign("/jobs");
      return;
    }

    if (storageStatus === "unavailable") {
      setIntakeError(
        "This browser is blocking device storage, so the posting cannot be saved yet.",
      );
      return;
    }

    const stashedJob = createStashedGuestJob(intakeType, validation.value);
    const nextDraft: GuestDraftV1 = {
      ...draft,
      updatedAt: new Date().toISOString(),
      stashedJobs: [stashedJob, ...draft.stashedJobs].slice(0, 20),
    };
    const result = saveGuestDraft(nextDraft);
    if (!result.ok) {
      setStorageStatus("unavailable");
      setIntakeError(
        "This browser could not save the posting on this device. Check storage settings and try again.",
      );
      return;
    }

    setDraft(nextDraft);
    setIntakeValue("");
    setIntakeSaved(true);
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-[1008px] items-center px-4 sm:px-6">
          <Link
            href="/start"
            className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-tight"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-brand text-[13px] text-white">
              C
            </span>
            COOPfinder
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated ? (
              <Button variant="outline" className="h-9 rounded-md" asChild>
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <Button variant="ghost" className="h-9 rounded-md" asChild>
                <Link href={getLoginHref("/start")}>Log in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1008px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Start with a real posting
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Build your co-op application plan
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Save a posting, add the profile details that matter, and compare
              your draft with a small set of Canadian co-op roles.
            </p>
          </div>
          <div
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              storageStatus === "unavailable"
                ? "border-warning/30 bg-warning-soft text-foreground"
                : "bg-card text-muted-foreground",
            )}
            title="Your draft lives in this browser. Create a free account to keep it."
          >
            <HardDrive className="size-3.5" aria-hidden />
            {storageStatus === "unavailable"
              ? "Device saving unavailable"
              : "Saved on this device only"}
          </div>
        </div>

        {storageStatus === "recovered" ? (
          <div className="mb-4 rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-sm">
            An unreadable device draft was replaced with a safe empty draft.
            Nothing was sent anywhere.
          </div>
        ) : null}
        {storageStatus === "unavailable" ? (
          <div className="mb-4 rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-sm">
            This browser is blocking device storage. You can explore the form,
            but changes may not survive a refresh.
          </div>
        ) : null}

        <section className="rounded-lg border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
              <BriefcaseBusiness className="size-4" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Found a role? Paste the link or job description.
              </h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                We will save it locally for now. No page is fetched and no
                requirements are analyzed on this screen.
              </p>
            </div>
          </div>

          <div
            className="mt-5 inline-flex rounded-md border bg-background p-1"
            role="group"
            aria-label="Job intake type"
          >
            <button
              type="button"
              onClick={() => {
                setIntakeType("url");
                setIntakeValue("");
                setIntakeError("");
                setIntakeSaved(false);
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors",
                intakeType === "url"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={intakeType === "url"}
            >
              <Link2 className="size-3.5" aria-hidden />
              Job link
            </button>
            <button
              type="button"
              onClick={() => {
                setIntakeType("text");
                setIntakeValue("");
                setIntakeError("");
                setIntakeSaved(false);
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors",
                intakeType === "text"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={intakeType === "text"}
            >
              <AlignLeft className="size-3.5" aria-hidden />
              Job description
            </button>
          </div>

          <div className="mt-3">
            {intakeType === "url" ? (
              <label className="block text-xs font-medium text-foreground">
                Job URL
                <Input
                  type="url"
                  value={intakeValue}
                  onChange={(event) => setIntakeValue(event.target.value)}
                  placeholder="https://company.ca/careers/software-coop"
                  className="mt-1.5 h-11 rounded-md bg-background px-3 text-sm"
                  autoComplete="url"
                  maxLength={2_048}
                />
              </label>
            ) : (
              <label className="block text-xs font-medium text-foreground">
                Job description
                <textarea
                  value={intakeValue}
                  onChange={(event) => setIntakeValue(event.target.value)}
                  placeholder="Paste the posting text here. It will be saved on this device, not analyzed yet."
                  className="mt-1.5 min-h-36 w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring/50"
                  maxLength={DESCRIPTION_LIMIT}
                />
                <span className="mt-1 block text-right text-xs text-muted-foreground">
                  {intakeValue.length.toLocaleString()} /{" "}
                  {DESCRIPTION_LIMIT.toLocaleString()}
                </span>
              </label>
            )}
          </div>

          {intakeError ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {intakeError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="h-10 rounded-md px-4"
              onClick={submitIntake}
              disabled={!hydrated}
            >
              {isAuthenticated ? "Continue in My jobs" : "Save on this device"}
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              {isAuthenticated
                ? "The posting stays in this browser session until private intake is built."
                : "Requirement extraction starts only after account creation."}
            </p>
          </div>

          {intakeSaved ? (
            <div className="mt-4 rounded-md border border-success/25 bg-success-soft p-3">
              <div className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Saved on this device.</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    Create a free account and we will extract the requirements
                    for your review and compare them with your profile.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {draft.stashedJobs.length > 0 ? (
            <div className="mt-5 border-t pt-4">
              <p className="text-xs font-medium text-foreground">
                Saved postings ({draft.stashedJobs.length})
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {draft.stashedJobs.slice(0, 4).map((job) => (
                  <div
                    key={job.id}
                    className="min-w-0 rounded-md border bg-background px-3 py-2"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {job.inputType === "url" ? (
                        <Link2 className="size-3" aria-hidden />
                      ) : (
                        <AlignLeft className="size-3" aria-hidden />
                      )}
                      {job.inputType === "url" ? "Job link" : "Description"}
                    </div>
                    <p className="mt-1 truncate text-sm text-foreground">
                      {formatStashedJob(job)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section id="profile" className="rounded-lg border bg-card p-5 sm:p-6">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Lightweight draft profile
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                Add what matters for this work term
              </h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Everything is optional. This is a quick matching draft, not
                your full Master Profile.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-foreground">
                School
                <select
                  value={draft.profile.school ?? ""}
                  onChange={(event) =>
                    updateProfile(
                      "school",
                      event.target.value
                        ? (event.target.value as GuestDraftProfile["school"])
                        : undefined,
                    )
                  }
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
                >
                  <option value="">Choose school</option>
                  {SCHOOL_OPTIONS.map((school) => (
                    <option key={school} value={school}>
                      {school}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-foreground">
                Program
                <Input
                  value={draft.profile.program ?? ""}
                  onChange={(event) =>
                    updateProfile("program", event.target.value || undefined)
                  }
                  placeholder="Computing Science"
                  className="mt-1.5 h-10 rounded-md bg-background text-sm"
                  maxLength={120}
                />
              </label>
              <label className="text-xs font-medium text-foreground">
                Intended work term
                <select
                  value={draft.profile.coopTerm ?? ""}
                  onChange={(event) =>
                    updateProfile("coopTerm", event.target.value || undefined)
                  }
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
                >
                  <option value="">Choose term</option>
                  {TERM_OPTIONS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-foreground">
                Work authorization
                <select
                  value={draft.profile.workAuthorization ?? ""}
                  onChange={(event) =>
                    updateProfile(
                      "workAuthorization",
                      event.target.value
                        ? (event.target
                            .value as GuestDraftProfile["workAuthorization"])
                        : undefined,
                    )
                  }
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
                >
                  <option value="">Choose answer</option>
                  {WORK_AUTHORIZATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="mt-5">
              <legend className="text-xs font-medium text-foreground">
                Target roles
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {TARGET_ROLE_OPTIONS.map((role) => {
                  const selected = draft.profile.targetRoles?.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        const roles = draft.profile.targetRoles ?? [];
                        updateProfile(
                          "targetRoles",
                          selected
                            ? roles.filter((item) => item !== role)
                            : [...roles, role],
                        );
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-brand/30 bg-brand-soft text-brand"
                          : "bg-background text-muted-foreground hover:border-border-strong hover:text-foreground",
                      )}
                      aria-pressed={selected}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-5">
              <TagInput
                id="profile-skills"
                label="Skills"
                tags={draft.skills}
                placeholder="TypeScript, React, Python..."
                onChange={(skills) =>
                  updateDraft((current) => ({ ...current, skills }))
                }
              />
            </div>

            <div className="mt-6 border-t pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    Experience and projects
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Add one or two real examples. These help surface skill
                    overlap; they are not rewritten here.
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                  {draft.entries.length}
                </span>
              </div>

              {draft.entries.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {draft.entries.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-md border bg-background p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs capitalize text-muted-foreground">
                            {entry.section}
                          </p>
                          <h4 className="mt-0.5 text-sm font-medium">
                            {entry.title}
                          </h4>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {entry.text}
                          </p>
                          {entry.skills.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {entry.skills.map((skill) => (
                                <span
                                  key={skill}
                                  className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft((current) => ({
                              ...current,
                              entries: current.entries.filter(
                                (item) => item.id !== entry.id,
                              ),
                            }))
                          }
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Remove ${entry.title}`}
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              <div className="mt-3">
                <EntryComposer
                  onAdd={(entry) =>
                    updateDraft((current) => ({
                      ...current,
                      entries: [...current.entries, entry],
                    }))
                  }
                />
              </div>
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-5">
            <section className="rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Directional preview
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {matches.length > 0
                      ? `${matches.length} roles match your profile so far`
                      : "Add profile details to see matches"}
                  </h2>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-info-soft text-info">
                  <Sparkles className="size-4" aria-hidden />
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Based on skill overlap, target role, term, and work
                authorization in the current starter set. No AI is used.
              </p>

              {matches.length > 0 ? (
                <div className="mt-4 space-y-2.5">
                  {matches.slice(0, 4).map((match) => (
                    <article
                      key={match.job.id}
                      className="rounded-md border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">
                            {match.job.companyName}
                          </p>
                          <p className="mt-0.5 text-sm leading-5 text-foreground">
                            {match.job.title}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-brand-soft px-2 py-1 text-[11px] font-medium text-brand">
                          Directional
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {match.job.location} · {match.job.workMode}
                      </p>
                      {[
                        ...match.matchedRequiredSkills,
                        ...match.matchedNiceToHaveSkills,
                      ].length > 0 ? (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Overlap: {[
                            ...match.matchedRequiredSkills,
                            ...match.matchedNiceToHaveSkills,
                          ]
                            .slice(0, 3)
                            .join(", ")}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-md border border-dashed bg-background px-3 py-4 text-center">
                  <p className="text-sm font-medium">No matches yet</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Add skills or choose target roles. Matching uses structured
                    overlap, not AI.
                  </p>
                </div>
              )}

              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Review the original posting before applying. This preview is
                limited to {publicStarterJobs.length} starter roles and does
                not analyze your newly saved posting.
              </p>
            </section>

            <section className="rounded-lg border bg-card p-5">
              <div className="flex items-center gap-2">
                <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
                <h2 className="text-sm font-semibold">Public job board</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Browse reviewed Canadian co-op roles with in-house summaries
                and links back to each original source.
              </p>
              <Button variant="outline" className="mt-3 h-9 w-full rounded-md" asChild>
                <Link href="/board">
                  <ArrowRight className="size-3.5" aria-hidden />
                  Browse job board
                </Link>
              </Button>
            </section>

            {hasValue && !isAuthenticated ? (
              <section className="rounded-lg border border-brand/25 bg-brand-soft p-5">
                <div className="flex items-center gap-2 text-brand">
                  <LockKeyhole className="size-4" aria-hidden />
                  <p className="text-xs font-medium uppercase">
                    Keep your progress
                  </p>
                </div>
                <h2 className="mt-2 text-base font-semibold text-foreground">
                  {matches.length > 0
                    ? `Your profile matches ${matches.length} starter roles`
                    : "Your device draft is ready"}
                </h2>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Create a free account to keep jobs private, save your
                  profile, extract requirements for review, and tailor a
                  reviewed resume. 2 free tailoring credits included, no card
                  required. Tracking is free.
                </p>
                <Button className="mt-4 h-10 w-full rounded-md" asChild>
                  <Link href={loginHref}>Create free account</Link>
                </Button>
                <a
                  href="#profile"
                  className="mt-2 flex h-9 items-center justify-center text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Keep exploring
                </a>
              </section>
            ) : null}

            {isAuthenticated ? (
              <section className="rounded-lg border bg-card p-5">
                <p className="text-sm font-semibold">Already signed in</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Continue building your complete source profile in the private
                  workspace.
                </p>
                <Button
                  variant="outline"
                  className="mt-3 h-9 w-full rounded-md"
                  asChild
                >
                  <Link href="/resumes/master">Open Master Profile</Link>
                </Button>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
