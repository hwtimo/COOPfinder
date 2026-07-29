"use client";

import { ArrowDown, ArrowUp, RotateCcw, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import {
  saveUserEditedResumeVersionAction,
  type SaveUserEditedResumeVersionState,
} from "@/app/(app)/resumes/versions/[versionId]/actions";
import { CardSection } from "@/components/app/card-section";
import { Button } from "@/components/ui/button";

import {
  moveEditableResumeBullet,
  removeEditableResumeBullet,
  toUserEditedTailoredResumeInput,
  updateEditableResumeBullet,
  type EditableResumeEntry,
} from "./tailored-resume-editor-state";

type TailoredResumeEditorProps = Readonly<{
  parentVersionId: string;
  initialEntries: readonly EditableResumeEntry[];
}>;

const INITIAL_SAVE_STATE = {
  status: "idle",
  message: "",
} as const satisfies SaveUserEditedResumeVersionState;

function cloneEntries(entries: readonly EditableResumeEntry[]) {
  return entries.map((entry) => ({
    ...entry,
    bullets: entry.bullets.map((bullet) => ({ ...bullet })),
  }));
}

export function TailoredResumeEditor({
  parentVersionId,
  initialEntries,
}: TailoredResumeEditorProps) {
  const [entries, setEntries] = useState<readonly EditableResumeEntry[]>(() =>
    cloneEntries(initialEntries),
  );
  const saveAction = useMemo(
    () => saveUserEditedResumeVersionAction.bind(null, parentVersionId),
    [parentVersionId],
  );
  const [state, formAction, pending] = useActionState(
    saveAction,
    INITIAL_SAVE_STATE,
  );
  const input = toUserEditedTailoredResumeInput(entries);
  const bulletCount = entries.reduce(
    (total, entry) => total + entry.bullets.length,
    0,
  );

  return (
    <div id="edit-version" className="scroll-mt-4 print:hidden">
      <CardSection
        title="Edit generated original"
        description="Changes save as a new user-edited version. The generated original remains unchanged."
      >
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="edit" value={JSON.stringify(input)} />
          <fieldset disabled={pending} className="space-y-5">
            {entries.map((entry) => (
              <section key={entry.entryId} className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {entry.heading}
                </h3>
                <div className="space-y-3">
                  {entry.bullets.map((bullet, index) => {
                    const inputId = `edited-bullet-${entry.entryId}-${bullet.fragmentId}`;
                    return (
                      <div
                        key={bullet.fragmentId}
                        className="space-y-2 rounded-md border bg-background p-3"
                      >
                        <label
                          htmlFor={inputId}
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Bullet {index + 1}
                        </label>
                        <textarea
                          id={inputId}
                          value={bullet.text}
                          maxLength={500}
                          rows={3}
                          className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                          onChange={(event) =>
                            setEntries((current) =>
                              updateEditableResumeBullet(
                                current,
                                entry.entryId,
                                bullet.fragmentId,
                                event.target.value,
                              ),
                            )
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={index === 0}
                            aria-label={`Move bullet ${index + 1} up in ${entry.heading}`}
                            onClick={() =>
                              setEntries((current) =>
                                moveEditableResumeBullet(
                                  current,
                                  entry.entryId,
                                  bullet.fragmentId,
                                  "up",
                                ),
                              )
                            }
                          >
                            <ArrowUp aria-hidden />
                            Move up
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={index === entry.bullets.length - 1}
                            aria-label={`Move bullet ${index + 1} down in ${entry.heading}`}
                            onClick={() =>
                              setEntries((current) =>
                                moveEditableResumeBullet(
                                  current,
                                  entry.entryId,
                                  bullet.fragmentId,
                                  "down",
                                ),
                              )
                            }
                          >
                            <ArrowDown aria-hidden />
                            Move down
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="xs"
                            aria-label={`Remove bullet ${index + 1} from ${entry.heading}`}
                            onClick={() =>
                              setEntries((current) =>
                                removeEditableResumeBullet(
                                  current,
                                  entry.entryId,
                                  bullet.fragmentId,
                                ),
                              )
                            }
                          >
                            <Trash2 aria-hidden />
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </fieldset>

          {bulletCount === 0 ? (
            <p role="alert" className="text-sm text-destructive">
              Keep at least one non-empty bullet before saving.
            </p>
          ) : null}
          {state.status === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setEntries(cloneEntries(initialEntries))}
            >
              <RotateCcw aria-hidden />
              Reset changes
            </Button>
            <Button type="submit" disabled={pending || bulletCount === 0}>
              {pending ? "Saving new version..." : "Save as new version"}
            </Button>
          </div>
        </form>
      </CardSection>
    </div>
  );
}
