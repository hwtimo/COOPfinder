"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  Check,
  Loader2,
  PencilLine,
  Plus,
  Save,
  ShieldQuestion,
  Trash2,
  X,
} from "lucide-react";
import { startTransition, useActionState, useRef, useState } from "react";

import { CardSection } from "@/components/app/card-section";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SCHOOL_OPTIONS, WORK_AUTHORIZATION_OPTIONS } from "@/lib/guest-draft/types";
import {
  CANDIDATE_LANGUAGE_PROFICIENCIES,
  parseCandidateEvidence,
  type CandidateEvidence,
  type CandidateLanguageProficiency,
} from "@/lib/master-profile/candidate-evidence";
import {
  RESUME_SOURCE_FRAGMENT_LIMITS,
  type ResumeSourceFragmentRecord,
} from "@/lib/master-profile/resume-source-fragments";
import {
  INITIAL_MASTER_PROFILE_SAVE_STATE,
  type MasterProfileData,
  type MasterProfileEntry,
  type MasterProfileSavePayload,
  type MasterProfileSection,
} from "@/lib/master-profile/types";

import { saveMasterProfileAction } from "./actions";

const sectionLabels: Record<MasterProfileSection, string> = {
  education: "Education",
  experience: "Experience",
  project: "Projects",
  skills: "Skills",
  certification: "Certifications",
  volunteer: "Volunteer experience",
};

const sectionOrder: MasterProfileSection[] = [
  "experience",
  "project",
  "education",
  "skills",
  "certification",
  "volunteer",
];

const proficiencyLabels: Record<CandidateLanguageProficiency, string> = {
  basic: "Basic",
  conversational: "Conversational",
  professional: "Professional",
  fluent: "Fluent",
  native: "Native",
};

type LanguageRow = {
  key: string;
  language: string;
  proficiency: "" | CandidateLanguageProficiency;
};

function commaValues(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function ConfirmChip({ confirmed }: { confirmed: boolean }) {
  return confirmed ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
      <BadgeCheck className="size-3" aria-hidden />
      Confirmed evidence
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
      <ShieldQuestion className="size-3" aria-hidden />
      Needs confirmation
    </span>
  );
}

function EntryCard({
  entry,
  disabled,
  onConfirm,
  onSave,
  onDelete,
  onFragmentsChange,
}: {
  entry: MasterProfileEntry;
  disabled: boolean;
  onConfirm: (id: string) => void;
  onSave: (id: string, source: string, text: string) => void;
  onDelete: (id: string) => void;
  onFragmentsChange: (
    id: string,
    fragments: ResumeSourceFragmentRecord[],
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState(entry.source);
  const [text, setText] = useState(entry.text);
  const [newFragmentText, setNewFragmentText] = useState("");
  const [newFragmentTags, setNewFragmentTags] = useState("");
  const fragments = entry.resumeFragments ?? [];

  const replaceFragments = (next: ResumeSourceFragmentRecord[]) =>
    onFragmentsChange(
      entry.id,
      next.map((fragment, order) => ({ ...fragment, order })),
    );

  const updateFragment = (
    fragmentId: string,
    changes: Partial<ResumeSourceFragmentRecord>,
  ) =>
    replaceFragments(
      fragments.map((fragment) =>
        fragment.fragmentId === fragmentId
          ? { ...fragment, ...changes }
          : fragment,
      ),
    );

  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <Input
            value={source}
            maxLength={160}
            onChange={(event) => setSource(event.target.value)}
            aria-label="Entry title"
            className="h-8 max-w-xs rounded-md bg-card text-sm"
            disabled={disabled}
          />
        ) : (
          <p className="text-sm font-medium text-foreground">{entry.source}</p>
        )}
        <ConfirmChip confirmed={entry.confirmed} />
      </div>

      {editing ? (
        <textarea
          value={text}
          maxLength={5_000}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          aria-label="Entry description"
          className="mt-2 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-6 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={disabled}
        />
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
          {entry.text}
        </p>
      )}

      {entry.skills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary"
            >
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        {editing ? (
          <>
            <Button
              size="sm"
              className="h-8 rounded-md"
              disabled={disabled || !source.trim() || !text.trim()}
              onClick={() => {
                onSave(entry.id, source.trim(), text.trim());
                setEditing(false);
              }}
            >
              <Check className="size-3.5" aria-hidden />
              Apply edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-md"
              disabled={disabled}
              onClick={() => {
                setSource(entry.source);
                setText(entry.text);
                setEditing(false);
              }}
            >
              <X className="size-3.5" aria-hidden />
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-md"
              disabled={disabled}
              onClick={() => setEditing(true)}
            >
              <PencilLine className="size-3.5" aria-hidden />
              Edit
            </Button>
            {!entry.confirmed ? (
              <Button
                size="sm"
                className="h-8 rounded-md"
                disabled={disabled}
                onClick={() => onConfirm(entry.id)}
              >
                <BadgeCheck className="size-3.5" aria-hidden />
                Confirm accuracy
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-md text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={() => onDelete(entry.id)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Remove
            </Button>
          </>
        )}
      </div>

      <div className="mt-4 border-t pt-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Resume bullets
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Only approved bullets may be used in generated resumes.
          </p>
        </div>

        {!entry.confirmed ? (
          <p className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Confirm this entry before adding or approving resume bullets.
          </p>
        ) : (
          <>
            {fragments.length > 0 ? (
              <div className="mt-3 space-y-3">
                {fragments.map((fragment, index) => {
                  const textId = `resume-fragment-text-${fragment.fragmentId}`;
                  const tagsId = `resume-fragment-tags-${fragment.fragmentId}`;
                  return (
                    <div
                      key={fragment.fragmentId}
                      className="rounded-md border bg-card p-3"
                    >
                      <label htmlFor={textId} className="block">
                        <span className="text-xs font-medium text-muted-foreground">
                          Bullet {index + 1}
                        </span>
                        <textarea
                          id={textId}
                          value={fragment.text}
                          maxLength={RESUME_SOURCE_FRAGMENT_LIMITS.textLength}
                          rows={2}
                          disabled={disabled}
                          className="mt-1 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onChange={(event) =>
                            updateFragment(fragment.fragmentId, {
                              text: event.target.value,
                              confirmed: false,
                            })
                          }
                        />
                      </label>
                      <label htmlFor={tagsId} className="mt-3 block">
                        <span className="text-xs font-medium text-muted-foreground">
                          Evidence tags (comma-separated)
                        </span>
                        <Input
                          id={tagsId}
                          value={fragment.evidenceTags.join(", ")}
                          disabled={disabled}
                          className="mt-1 h-9 rounded-md bg-background"
                          onChange={(event) =>
                            updateFragment(fragment.fragmentId, {
                              evidenceTags: commaValues(event.target.value),
                              confirmed: false,
                            })
                          }
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                        {fragment.confirmed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <BadgeCheck className="size-3.5" aria-hidden />
                            Approved for tailoring
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-md"
                            disabled={disabled || !fragment.text.trim()}
                            onClick={() =>
                              updateFragment(fragment.fragmentId, {
                                confirmed: true,
                              })
                            }
                          >
                            <BadgeCheck className="size-3.5" aria-hidden />
                            Approve for tailoring
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="ml-auto rounded-md"
                          disabled={disabled || index === 0}
                          aria-label={`Move resume bullet ${index + 1} up`}
                          onClick={() => {
                            const next = [...fragments];
                            [next[index - 1], next[index]] = [
                              next[index]!,
                              next[index - 1]!,
                            ];
                            replaceFragments(next);
                          }}
                        >
                          <ArrowUp className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="rounded-md"
                          disabled={disabled || index === fragments.length - 1}
                          aria-label={`Move resume bullet ${index + 1} down`}
                          onClick={() => {
                            const next = [...fragments];
                            [next[index], next[index + 1]] = [
                              next[index + 1]!,
                              next[index]!,
                            ];
                            replaceFragments(next);
                          }}
                        >
                          <ArrowDown className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="rounded-md text-destructive hover:text-destructive"
                          disabled={disabled}
                          aria-label={`Remove resume bullet ${index + 1}`}
                          onClick={() =>
                            replaceFragments(
                              fragments.filter(
                                (item) =>
                                  item.fragmentId !== fragment.fragmentId,
                              ),
                            )
                          }
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No resume bullets added.
              </p>
            )}

            <div className="mt-3 grid gap-3 rounded-md border border-dashed bg-card p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto] sm:items-end">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  New resume bullet
                </span>
                <textarea
                  value={newFragmentText}
                  maxLength={RESUME_SOURCE_FRAGMENT_LIMITS.textLength}
                  rows={2}
                  disabled={disabled}
                  className="mt-1 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => setNewFragmentText(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  Evidence tags
                </span>
                <Input
                  value={newFragmentTags}
                  disabled={disabled}
                  className="mt-1 h-9 rounded-md bg-background"
                  placeholder="TypeScript, analytics"
                  onChange={(event) => setNewFragmentTags(event.target.value)}
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 rounded-md"
                disabled={
                  disabled ||
                  !newFragmentText.trim() ||
                  fragments.length >=
                    RESUME_SOURCE_FRAGMENT_LIMITS.fragmentsPerEntry
                }
                onClick={() => {
                  replaceFragments([
                    ...fragments,
                    {
                      fragmentId: crypto.randomUUID(),
                      text: newFragmentText,
                      evidenceTags: commaValues(newFragmentTags),
                      confirmed: false,
                      order: fragments.length,
                      provenance: "manual",
                    },
                  ]);
                  setNewFragmentText("");
                  setNewFragmentTags("");
                }}
              >
                <Plus className="size-3.5" aria-hidden />
                Add bullet
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

export function MasterProfileClient({ initialData }: { initialData: MasterProfileData }) {
  const [profile, setProfile] = useState(initialData);
  const [locationsText, setLocationsText] = useState(
    initialData.preferredLocations.join(", "),
  );
  const [targetRolesText, setTargetRolesText] = useState(
    initialData.targetRoles.join(", "),
  );
  const [skillsText, setSkillsText] = useState(initialData.skills.join(", "));
  const initialEvidence = initialData.candidateEvidence;
  const [technologiesText, setTechnologiesText] = useState(
    initialEvidence?.technologies?.join(", ") ?? "",
  );
  const [softSkillsText, setSoftSkillsText] = useState(
    initialEvidence?.softSkills?.join(", ") ?? "",
  );
  const [certificationsText, setCertificationsText] = useState(
    initialEvidence?.certifications?.join(", ") ?? "",
  );
  const nextLanguageKey = useRef(initialEvidence?.languages?.length ?? 0);
  const [languageRows, setLanguageRows] = useState<LanguageRow[]>(
    (initialEvidence?.languages ?? []).map((language, index) => ({
      key: `stored-language-${index}`,
      language: language.language,
      proficiency: language.proficiency ?? "",
    })),
  );
  const [evidencePresence, setEvidencePresence] = useState(() => ({
    object: initialEvidence !== undefined,
    technologies:
      initialEvidence !== undefined && "technologies" in initialEvidence,
    softSkills: initialEvidence !== undefined && "softSkills" in initialEvidence,
    certifications:
      initialEvidence !== undefined && "certifications" in initialEvidence,
    languages: initialEvidence !== undefined && "languages" in initialEvidence,
  }));
  const [editingProfile, setEditingProfile] = useState(initialData.fullName === "" && initialData.entries.length === 0);
  const [adding, setAdding] = useState(false);
  const [newSection, setNewSection] = useState<MasterProfileSection>("experience");
  const [newSource, setNewSource] = useState("");
  const [newText, setNewText] = useState("");
  const [newSkills, setNewSkills] = useState("");
  const [saveState, saveAction, saving] = useActionState(
    saveMasterProfileAction,
    INITIAL_MASTER_PROFILE_SAVE_STATE,
  );

  const updateProfile = (changes: Partial<MasterProfileData>) =>
    setProfile((current) => ({ ...current, ...changes }));

  const markEvidencePresent = (
    field: "technologies" | "softSkills" | "certifications" | "languages",
  ) =>
    setEvidencePresence((current) => ({
      ...current,
      object: true,
      [field]: true,
    }));

  const currentCandidateEvidence = (): CandidateEvidence | undefined => {
    if (!evidencePresence.object) return undefined;
    const raw: CandidateEvidence = {};
    if (evidencePresence.technologies) {
      raw.technologies = commaValues(technologiesText);
    }
    if (evidencePresence.softSkills) {
      raw.softSkills = commaValues(softSkillsText);
    }
    if (evidencePresence.certifications) {
      raw.certifications = commaValues(certificationsText);
    }
    if (evidencePresence.languages) {
      raw.languages = languageRows.map((row) => ({
        language: row.language,
        ...(row.proficiency ? { proficiency: row.proficiency } : {}),
      }));
    }
    const parsed = parseCandidateEvidence(raw);
    return parsed.status === "valid" ? parsed.evidence : raw;
  };

  const saveProfile = () => {
    const preferredLocations = commaValues(locationsText);
    const targetRoles = commaValues(targetRolesText);
    const skills = commaValues(skillsText);
    const candidateEvidence = currentCandidateEvidence();
    const payload: MasterProfileSavePayload = {
      fullName: profile.fullName,
      school: profile.school,
      program: profile.program,
      gradYear: profile.gradYear,
      coopTerm: profile.coopTerm,
      workAuthorization: profile.workAuthorization,
      preferredLocations,
      targetRoles,
      skills,
      entries: profile.entries,
      ...(candidateEvidence === undefined ? {} : { candidateEvidence }),
    };
    updateProfile({
      preferredLocations,
      targetRoles,
      skills,
      ...(candidateEvidence === undefined ? {} : { candidateEvidence }),
    });
    startTransition(() => saveAction(payload));
  };

  const finishProfileEditing = () => {
    updateProfile({
      preferredLocations: commaValues(locationsText),
      targetRoles: commaValues(targetRolesText),
      skills: commaValues(skillsText),
    });
    setEditingProfile(false);
  };

  const resetAddForm = () => {
    setNewSection("experience");
    setNewSource("");
    setNewText("");
    setNewSkills("");
    setAdding(false);
  };

  const addEntry = () => {
    updateProfile({
      entries: [
        ...profile.entries,
        {
          id: `local-${Date.now()}`,
          section: newSection,
          source: newSource.trim(),
          text: newText.trim(),
          skills: commaValues(newSkills),
          confirmed: false,
          sortOrder: profile.entries.length,
          resumeFragments: [],
        },
      ],
    });
    resetAddForm();
  };

  const confirmedCount = profile.entries.filter((entry) => entry.confirmed).length;
  const contextDescription = [
    profile.school,
    profile.program,
    profile.coopTerm || (profile.gradYear ? `Graduating ${profile.gradYear}` : ""),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <Link
        href="/resumes"
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to resumes
      </Link>

      <PageHeader
        title="Master profile"
        description="Keep a private, factual source of truth for your experience and skills."
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-md"
              onClick={() => setAdding(true)}
              disabled={adding || saving}
            >
              <Plus className="size-4" aria-hidden />
              Add entry
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-md"
              onClick={saveProfile}
              disabled={saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
              {saving ? "Saving profile" : "Save profile"}
            </Button>
          </>
        }
      />

      {saveState.status !== "idle" ? (
        <p
          role={saveState.status === "error" ? "alert" : "status"}
          className={`rounded-md border px-3 py-2 text-sm ${
            saveState.status === "success"
              ? "border-success/25 bg-success-soft text-foreground"
              : "border-destructive/20 bg-destructive-soft text-foreground"
          }`}
        >
          {saveState.message}
        </p>
      ) : null}

      <CardSection
        title={profile.fullName || "Your master profile"}
        description={contextDescription || "Add your school, program, and co-op context."}
        contentClassName="p-5"
        action={
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-md"
            disabled={saving}
            onClick={() => {
              if (editingProfile) finishProfileEditing();
              else setEditingProfile(true);
            }}
          >
            {editingProfile ? <Check className="size-3.5" aria-hidden /> : <PencilLine className="size-3.5" aria-hidden />}
            {editingProfile ? "Done editing" : "Edit profile"}
          </Button>
        }
      >
        {editingProfile ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name">
              <Input className="h-9 rounded-md bg-card" maxLength={160} value={profile.fullName} onChange={(event) => updateProfile({ fullName: event.target.value })} disabled={saving} />
            </Field>
            <Field label="School">
              <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={profile.school} onChange={(event) => updateProfile({ school: event.target.value })} disabled={saving}>
                <option value="">Not set</option>
                {SCHOOL_OPTIONS.map((school) => <option key={school} value={school}>{school}</option>)}
              </select>
            </Field>
            <Field label="Program">
              <Input className="h-9 rounded-md bg-card" maxLength={120} value={profile.program} onChange={(event) => updateProfile({ program: event.target.value })} disabled={saving} />
            </Field>
            <Field label="Current co-op term">
              <Input className="h-9 rounded-md bg-card" maxLength={80} value={profile.coopTerm} onChange={(event) => updateProfile({ coopTerm: event.target.value })} placeholder="e.g. Fall 2026" disabled={saving} />
            </Field>
            <Field label="Graduation year">
              <Input className="h-9 rounded-md bg-card" inputMode="numeric" maxLength={4} value={profile.gradYear} onChange={(event) => updateProfile({ gradYear: event.target.value.replace(/\D/g, "").slice(0, 4) })} disabled={saving} />
            </Field>
            <Field label="Work authorization">
              <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={profile.workAuthorization} onChange={(event) => updateProfile({ workAuthorization: event.target.value })} disabled={saving}>
                <option value="">Not set</option>
                {WORK_AUTHORIZATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Preferred locations">
              <Input className="h-9 rounded-md bg-card" value={locationsText} onChange={(event) => setLocationsText(event.target.value)} placeholder="Vancouver, Burnaby" disabled={saving} />
            </Field>
            <Field label="Target roles">
              <Input className="h-9 rounded-md bg-card" value={targetRolesText} onChange={(event) => setTargetRolesText(event.target.value)} placeholder="Software co-op, Data analyst" disabled={saving} />
            </Field>
            <Field label="Skills">
              <Input className="h-9 rounded-md bg-card" value={skillsText} onChange={(event) => setSkillsText(event.target.value)} placeholder="TypeScript, Python, C++" disabled={saving} />
            </Field>
          </div>
        ) : (
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-0.5 break-words text-foreground">{profile.email}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Preferred locations</dt><dd className="mt-0.5 text-foreground">{profile.preferredLocations.join(", ") || "Not set"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Work authorization</dt><dd className="mt-0.5 text-foreground">{profile.workAuthorization || "Not set"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Target roles</dt><dd className="mt-0.5 text-foreground">{profile.targetRoles.join(", ") || "Not set"}</dd></div>
            <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs text-muted-foreground">Skills</dt><dd className="mt-1 flex flex-wrap gap-1.5">{profile.skills.length ? profile.skills.map((skill) => <span key={skill} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">{skill}</span>) : <span className="text-foreground">Not set</span>}</dd></div>
          </dl>
        )}
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground tabular-nums">
          {confirmedCount} of {profile.entries.length} entries confirmed
        </p>
      </CardSection>

      <CardSection
        title="Skills and credentials"
        description="Add explicit evidence used for exact profile matching. General skills remain in the profile section above."
        contentClassName="space-y-5 p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Technologies">
            <Input
              className="h-9 rounded-md bg-card"
              value={technologiesText}
              onChange={(event) => {
                setTechnologiesText(event.target.value);
                markEvidencePresent("technologies");
              }}
              placeholder="TypeScript, PostgreSQL"
              disabled={saving}
            />
          </Field>
          <Field label="Soft skills">
            <Input
              className="h-9 rounded-md bg-card"
              value={softSkillsText}
              onChange={(event) => {
                setSoftSkillsText(event.target.value);
                markEvidencePresent("softSkills");
              }}
              placeholder="Communication, collaboration"
              disabled={saving}
            />
          </Field>
          <Field label="Certifications">
            <Input
              className="h-9 rounded-md bg-card"
              value={certificationsText}
              onChange={(event) => {
                setCertificationsText(event.target.value);
                markEvidencePresent("certifications");
              }}
              placeholder="Certification names"
              disabled={saving}
            />
          </Field>
        </div>

        <div className="border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Languages</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Proficiency is optional context and is not used to decide an exact match.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-md"
              disabled={saving}
              onClick={() => {
                const key = `new-language-${nextLanguageKey.current++}`;
                setLanguageRows((current) => [
                  ...current,
                  { key, language: "", proficiency: "" },
                ]);
                markEvidencePresent("languages");
              }}
            >
              <Plus className="size-3.5" aria-hidden />
              Add language
            </Button>
          </div>

          {languageRows.length > 0 ? (
            <div className="mt-4 space-y-3">
              {languageRows.map((row, index) => {
                const languageId = `candidate-language-${row.key}`;
                const proficiencyId = `candidate-language-proficiency-${row.key}`;
                return (
                  <div
                    key={row.key}
                    className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                  >
                    <label htmlFor={languageId} className="block">
                      <span className="text-xs font-medium text-muted-foreground">
                        Language {index + 1}
                      </span>
                      <Input
                        id={languageId}
                        className="mt-1 h-9 rounded-md bg-card"
                        value={row.language}
                        maxLength={80}
                        disabled={saving}
                        onChange={(event) => {
                          const language = event.target.value;
                          setLanguageRows((current) =>
                            current.map((item) =>
                              item.key === row.key ? { ...item, language } : item,
                            ),
                          );
                          markEvidencePresent("languages");
                        }}
                      />
                    </label>
                    <label htmlFor={proficiencyId} className="block">
                      <span className="text-xs font-medium text-muted-foreground">
                        Proficiency (optional)
                      </span>
                      <select
                        id={proficiencyId}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                        value={row.proficiency}
                        disabled={saving}
                        onChange={(event) => {
                          const proficiency = event.target.value as
                            | ""
                            | CandidateLanguageProficiency;
                          setLanguageRows((current) =>
                            current.map((item) =>
                              item.key === row.key
                                ? { ...item, proficiency }
                                : item,
                            ),
                          );
                          markEvidencePresent("languages");
                        }}
                      >
                        <option value="">Not specified</option>
                        {CANDIDATE_LANGUAGE_PROFICIENCIES.map((proficiency) => (
                          <option key={proficiency} value={proficiency}>
                            {proficiencyLabels[proficiency]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-md text-destructive hover:text-destructive"
                      disabled={saving}
                      aria-label={`Remove language ${index + 1}`}
                      onClick={() => {
                        setLanguageRows((current) =>
                          current.filter((item) => item.key !== row.key),
                        );
                        markEvidencePresent("languages");
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No languages added.
            </p>
          )}
        </div>
      </CardSection>

      {adding ? (
        <CardSection title="New entry" description="New entries stay unconfirmed until you verify their accuracy." contentClassName="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={newSection} onChange={(event) => setNewSection(event.target.value as MasterProfileSection)} disabled={saving}>
                {sectionOrder.map((section) => <option key={section} value={section}>{sectionLabels[section]}</option>)}
              </select>
            </Field>
            <Field label="Title / source">
              <Input className="h-9 rounded-md bg-card" maxLength={160} value={newSource} onChange={(event) => setNewSource(event.target.value)} placeholder="e.g. Hackathon web app" disabled={saving} />
            </Field>
          </div>
          <Field label="What did you actually do?">
            <textarea className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-6" rows={3} maxLength={5_000} value={newText} onChange={(event) => setNewText(event.target.value)} placeholder="Describe the work in factual sentences or bullets." disabled={saving} />
          </Field>
          <Field label="Skills used (comma-separated)">
            <Input className="h-9 rounded-md bg-card" value={newSkills} onChange={(event) => setNewSkills(event.target.value)} placeholder="React, TypeScript, REST APIs" disabled={saving} />
          </Field>
          <div className="flex gap-2 border-t pt-4">
            <Button size="sm" className="h-9 rounded-md" onClick={addEntry} disabled={saving || !newSource.trim() || !newText.trim()}><Plus className="size-4" aria-hidden />Add to profile</Button>
            <Button size="sm" variant="ghost" className="h-9 rounded-md" onClick={resetAddForm} disabled={saving}>Cancel</Button>
          </div>
        </CardSection>
      ) : null}

      {profile.entries.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No experience or evidence yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add factual work, project, education, skill, certification, or volunteer evidence.</p>
          <Button size="sm" className="mt-4 h-9 rounded-md" onClick={() => setAdding(true)} disabled={adding || saving}><Plus className="size-4" aria-hidden />Add first entry</Button>
        </div>
      ) : null}

      {sectionOrder.map((section) => {
        const sectionEntries = profile.entries.filter((entry) => entry.section === section);
        if (!sectionEntries.length) return null;
        return (
          <CardSection key={section} title={sectionLabels[section]} contentClassName="space-y-3 p-5">
            {sectionEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                disabled={saving}
                onConfirm={(id) => updateProfile({ entries: profile.entries.map((item) => item.id === id ? { ...item, confirmed: true } : item) })}
                onSave={(id, source, text) => updateProfile({ entries: profile.entries.map((item) => item.id === id ? { ...item, source, text, confirmed: false } : item) })}
                onDelete={(id) => updateProfile({ entries: profile.entries.filter((item) => item.id !== id).map((item, index) => ({ ...item, sortOrder: index })) })}
                onFragmentsChange={(id, resumeFragments) => updateProfile({ entries: profile.entries.map((item) => item.id === id ? { ...item, resumeFragments } : item) })}
              />
            ))}
          </CardSection>
        );
      })}
    </div>
  );
}
