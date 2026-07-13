"use client";

import Link from "next/link";
import {
  ArrowLeft,
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
import { startTransition, useActionState, useState } from "react";

import { CardSection } from "@/components/app/card-section";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SCHOOL_OPTIONS, WORK_AUTHORIZATION_OPTIONS } from "@/lib/guest-draft/types";
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
}: {
  entry: MasterProfileEntry;
  disabled: boolean;
  onConfirm: (id: string) => void;
  onSave: (id: string, source: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState(entry.source);
  const [text, setText] = useState(entry.text);

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

  const saveProfile = () => {
    const preferredLocations = commaValues(locationsText);
    const targetRoles = commaValues(targetRolesText);
    const skills = commaValues(skillsText);
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
    };
    updateProfile({ preferredLocations, targetRoles, skills });
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
              />
            ))}
          </CardSection>
        );
      })}
    </div>
  );
}
