import { Sparkles } from "lucide-react";

import type {
  ResumeProfileDraftEntry,
  ResumeProfileDraftV1,
} from "@/lib/resumes/resume-profile-draft-contract";

export function ResumeProfileDraftPreview({
  draft,
}: {
  draft: ResumeProfileDraftV1;
}) {
  return (
    <section
      aria-labelledby="resume-profile-draft"
      className="space-y-4 border-t border-border pt-4"
    >
      <div className="flex items-start gap-2">
        <Sparkles
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden
        />
        <div>
          <h3 id="resume-profile-draft" className="text-sm font-semibold">
            Master Profile draft — review required
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            This temporary AI draft has not been saved. Every item is
            unconfirmed and must be reviewed before it can become profile
            evidence.
          </p>
        </div>
      </div>

      <DraftSkillList skills={draft.skills} />
      <DraftEntryGroup title="Education" entries={draft.education} />
      <DraftEntryGroup
        title="Work experience"
        entries={draft.workExperience}
      />
      <DraftEntryGroup title="Projects" entries={draft.projects} />
      <DraftEntryGroup
        title="Leadership and activities"
        entries={draft.leadershipActivities}
      />
    </section>
  );
}

function DraftSkillList({ skills }: { skills: readonly string[] }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Skills
      </h4>
      {skills.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <li
              key={skill.toLocaleLowerCase("en-CA")}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-xs"
            >
              {skill}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No draft items found.</p>
      )}
    </div>
  );
}

function DraftEntryGroup({
  title,
  entries,
}: {
  title: string;
  entries: readonly ResumeProfileDraftEntry[];
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.temporaryId}
              className="rounded-md border border-border bg-background p-3"
            >
              <p className="whitespace-pre-wrap text-sm leading-6">
                {entry.text}
              </p>
              <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                Unconfirmed draft
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No draft items found.</p>
      )}
    </div>
  );
}
