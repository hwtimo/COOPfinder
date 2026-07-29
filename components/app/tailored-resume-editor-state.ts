import {
  USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
  type UserEditedTailoredResumeInputV1,
} from "@/lib/tailoring/user-edited-tailored-resume-input";

export type EditableResumeBullet = Readonly<{
  fragmentId: string;
  text: string;
}>;

export type EditableResumeEntry = Readonly<{
  entryId: string;
  heading: string;
  bullets: readonly EditableResumeBullet[];
}>;

export function updateEditableResumeBullet(
  entries: readonly EditableResumeEntry[],
  entryId: string,
  fragmentId: string,
  text: string,
): EditableResumeEntry[] {
  return entries.map((entry) =>
    entry.entryId !== entryId
      ? entry
      : {
          ...entry,
          bullets: entry.bullets.map((bullet) =>
            bullet.fragmentId === fragmentId ? { ...bullet, text } : bullet,
          ),
        },
  );
}

export function removeEditableResumeBullet(
  entries: readonly EditableResumeEntry[],
  entryId: string,
  fragmentId: string,
): EditableResumeEntry[] {
  return entries.flatMap((entry) => {
    if (entry.entryId !== entryId) return [entry];
    const bullets = entry.bullets.filter(
      (bullet) => bullet.fragmentId !== fragmentId,
    );
    return bullets.length > 0 ? [{ ...entry, bullets }] : [];
  });
}

export function moveEditableResumeBullet(
  entries: readonly EditableResumeEntry[],
  entryId: string,
  fragmentId: string,
  direction: "up" | "down",
): EditableResumeEntry[] {
  return entries.map((entry) => {
    if (entry.entryId !== entryId) return entry;
    const bullets = [...entry.bullets];
    const index = bullets.findIndex(
      (bullet) => bullet.fragmentId === fragmentId,
    );
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= bullets.length) return entry;
    [bullets[index], bullets[nextIndex]] = [
      bullets[nextIndex],
      bullets[index],
    ];
    return { ...entry, bullets };
  });
}

export function toUserEditedTailoredResumeInput(
  entries: readonly EditableResumeEntry[],
): UserEditedTailoredResumeInputV1 {
  return {
    contractVersion: USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
    entries: entries.map((entry) => ({
      entryId: entry.entryId,
      bullets: entry.bullets.map((bullet) => ({
        fragmentId: bullet.fragmentId,
        text: bullet.text,
      })),
    })),
  };
}
