"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  PencilLine,
  Plus,
  ShieldQuestion,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { CardSection } from "@/components/app/card-section";
import { cn } from "@/lib/utils";
import type {
  MockMasterResume,
  MockResumeBullet,
  MockStudentProfile,
} from "@/lib/mock";

interface MasterProfileClientProps {
  profile: MockStudentProfile;
  masterResume: MockMasterResume;
}

type EntrySection = MockResumeBullet["section"];

interface ProfileEntry {
  id: string;
  section: EntrySection;
  source: string;
  text: string;
  skills: string[];
  confirmed: boolean;
}

const sectionLabels: Record<EntrySection, string> = {
  education: "Education",
  experience: "Experience",
  project: "Projects",
  skills: "Skills",
};

const sectionOrder: EntrySection[] = [
  "experience",
  "project",
  "education",
  "skills",
];

function ConfirmChip({ confirmed }: { confirmed: boolean }) {
  return confirmed ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
      <BadgeCheck className="size-3" aria-hidden />
      Confirmed · usable by AI
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
      <ShieldQuestion className="size-3" aria-hidden />
      Needs confirmation
    </span>
  );
}

interface EntryCardProps {
  entry: ProfileEntry;
  onConfirm: (id: string) => void;
  onSave: (id: string, updates: { source: string; text: string }) => void;
}

function EntryCard({ entry, onConfirm, onSave }: EntryCardProps) {
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState(entry.source);
  const [text, setText] = useState(entry.text);

  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <Input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            aria-label="Entry title"
            className="h-8 max-w-xs bg-card text-sm"
          />
        ) : (
          <p className="text-sm font-medium text-foreground">{entry.source}</p>
        )}
        <ConfirmChip confirmed={entry.confirmed} />
      </div>

      {editing ? (
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          aria-label="Entry description"
          className="mt-2 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-6 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <p className="mt-2 text-sm leading-6 text-text-secondary">
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
              className="h-8"
              disabled={text.trim().length === 0 || source.trim().length === 0}
              onClick={() => {
                onSave(entry.id, {
                  source: source.trim(),
                  text: text.trim(),
                });
                setEditing(false);
              }}
            >
              <Check className="size-3.5" aria-hidden />
              Save changes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
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
              className="h-8"
              onClick={() => setEditing(true)}
            >
              <PencilLine className="size-3.5" aria-hidden />
              Edit
            </Button>
            {!entry.confirmed ? (
              <Button
                size="sm"
                className="h-8"
                onClick={() => onConfirm(entry.id)}
              >
                <BadgeCheck className="size-3.5" aria-hidden />
                Confirm accuracy
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function MasterProfileClient({
  profile,
  masterResume,
}: MasterProfileClientProps) {
  const [entries, setEntries] = useState<ProfileEntry[]>(() =>
    masterResume.bullets.map((bullet) => ({
      id: bullet.id,
      section: bullet.section,
      source: bullet.source,
      text: bullet.text,
      skills: bullet.skills,
      confirmed: true,
    })),
  );

  const [adding, setAdding] = useState(false);
  const [newSection, setNewSection] = useState<EntrySection>("project");
  const [newSource, setNewSource] = useState("");
  const [newText, setNewText] = useState("");
  const [newSkills, setNewSkills] = useState("");

  const confirmEntry = (id: string) =>
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, confirmed: true } : entry,
      ),
    );

  const saveEntry = (id: string, updates: { source: string; text: string }) =>
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? /* Edits must be re-confirmed before AI may cite them */
            { ...entry, ...updates, confirmed: false }
          : entry,
      ),
    );

  const resetForm = () => {
    setNewSection("project");
    setNewSource("");
    setNewText("");
    setNewSkills("");
    setAdding(false);
  };

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        section: newSection,
        source: newSource.trim(),
        text: newText.trim(),
        skills: newSkills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        confirmed: false,
      },
    ]);
    resetForm();
  };

  const confirmedCount = entries.filter((entry) => entry.confirmed).length;

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
        description="Everything the AI is allowed to use when tailoring. Add all real experience — more entries mean better suggestions."
        actions={
          <Button
            size="sm"
            className="h-9"
            onClick={() => setAdding(true)}
            disabled={adding}
          >
            <Plus className="size-4" aria-hidden />
            Add entry
          </Button>
        }
      />

      <CardSection
        title={profile.name}
        description={`Simon Fraser University · ${profile.program} · ${profile.year}`}
        contentClassName="p-5"
        action={
          <span className="text-xs text-muted-foreground tabular-nums">
            {confirmedCount} of {entries.length} entries confirmed
          </span>
        }
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="mt-0.5 text-foreground">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Location</dt>
            <dd className="mt-0.5 text-foreground">{profile.location}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Work authorization
            </dt>
            <dd className="mt-0.5 text-foreground">
              {profile.workAuthorization}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Target roles</dt>
            <dd className="mt-0.5 text-foreground">
              {profile.targetRoles.join(", ")}
            </dd>
          </div>
        </dl>
      </CardSection>

      {adding ? (
        <CardSection
          title="New entry"
          description="Added entries start as “Needs confirmation” until you confirm their accuracy."
          contentClassName="space-y-4 p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="new-entry-section"
                className="text-xs font-medium text-muted-foreground"
              >
                Type
              </label>
              <select
                id="new-entry-section"
                value={newSection}
                onChange={(event) =>
                  setNewSection(event.target.value as EntrySection)
                }
                className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="experience">Experience</option>
                <option value="project">Project</option>
                <option value="skills">Skill</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="new-entry-source"
                className="text-xs font-medium text-muted-foreground"
              >
                Title / source
              </label>
              <Input
                id="new-entry-source"
                value={newSource}
                onChange={(event) => setNewSource(event.target.value)}
                placeholder="e.g. Hackathon web app"
                className="mt-1 h-9 bg-card"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="new-entry-text"
              className="text-xs font-medium text-muted-foreground"
            >
              What did you actually do?
            </label>
            <textarea
              id="new-entry-text"
              value={newText}
              onChange={(event) => setNewText(event.target.value)}
              rows={3}
              placeholder="Describe the work in one or two factual sentences."
              className="mt-1 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label
              htmlFor="new-entry-skills"
              className="text-xs font-medium text-muted-foreground"
            >
              Skills used (comma-separated)
            </label>
            <Input
              id="new-entry-skills"
              value={newSkills}
              onChange={(event) => setNewSkills(event.target.value)}
              placeholder="React, TypeScript, REST APIs"
              className="mt-1 h-9 bg-card"
            />
          </div>
          <div className="flex gap-2 border-t pt-4">
            <Button
              size="sm"
              className="h-9"
              onClick={addEntry}
              disabled={
                newSource.trim().length === 0 || newText.trim().length === 0
              }
            >
              <Plus className="size-4" aria-hidden />
              Add to master profile
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9"
              onClick={resetForm}
            >
              Cancel
            </Button>
          </div>
        </CardSection>
      ) : null}

      {sectionOrder.map((section) => {
        const sectionEntries = entries.filter(
          (entry) => entry.section === section,
        );
        if (sectionEntries.length === 0) return null;
        return (
          <CardSection
            key={section}
            title={sectionLabels[section]}
            description={
              section === "skills"
                ? "Skills the AI may reference in tailored drafts"
                : undefined
            }
            contentClassName={cn("space-y-3 p-5")}
          >
            {sectionEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onConfirm={confirmEntry}
                onSave={saveEntry}
              />
            ))}
          </CardSection>
        );
      })}
    </div>
  );
}
