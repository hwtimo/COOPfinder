import { z } from "zod";

import type { DeepReadonly } from "./tailoring-provider-contracts";
import {
  tailoredResumeDocumentV1Schema,
  type TailoredResumeDocumentV1,
} from "./tailored-resume-document";
import {
  parseTailoredResumeVersionContent,
  type TailoredResumeVersionContentV2,
} from "./tailored-resume-version-content";
import { userEditedTailoredResumeInputV1Schema } from "./user-edited-tailored-resume-input";

export {
  USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
  userEditedTailoredResumeInputV1Schema,
  type UserEditedTailoredResumeInputV1,
} from "./user-edited-tailored-resume-input";

export const USER_EDITED_TAILORED_RESUME_CONTENT_CONTRACT_VERSION =
  "user-edited-tailored-resume-content-v1" as const;

export const userEditedTailoredResumeVersionContentV1Schema = z
  .object({
    contractVersion: z.literal(
      USER_EDITED_TAILORED_RESUME_CONTENT_CONTRACT_VERSION,
    ),
    authorship: z.literal("user"),
    parentVersionId: z.string().uuid(),
    document: tailoredResumeDocumentV1Schema,
  })
  .strict();

export type UserEditedTailoredResumeVersionContentV1 = DeepReadonly<
  z.infer<typeof userEditedTailoredResumeVersionContentV1Schema>
>;

export type BuildUserEditedTailoredResumeVersionResult =
  | Readonly<{
      status: "success";
      content: UserEditedTailoredResumeVersionContentV1;
    }>
  | Readonly<{ status: "invalid_parent" | "invalid_document" }>;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value) as DeepReadonly<T>;
}

type ParentEntry = Readonly<{
  sectionIndex: number;
  entryIndex: number;
  entry: TailoredResumeDocumentV1["sections"][number]["entries"][number];
}>;

function indexParentEntries(parent: TailoredResumeVersionContentV2) {
  const entries = new Map<string, ParentEntry>();
  for (const [sectionIndex, section] of parent.document.sections.entries()) {
    for (const [entryIndex, entry] of section.entries.entries()) {
      const entryId = entry.bullets[0]?.provenance.entryId;
      if (
        !entryId ||
        entry.bullets.some((bullet) => bullet.provenance.entryId !== entryId) ||
        entries.has(entryId)
      ) {
        return null;
      }
      entries.set(entryId, { sectionIndex, entryIndex, entry });
    }
  }
  return entries;
}

export function buildUserEditedTailoredResumeVersion(
  parentVersionId: string,
  parentValue: unknown,
  editValue: unknown,
): BuildUserEditedTailoredResumeVersionResult {
  const parent = parseTailoredResumeVersionContent(parentValue);
  const edit = userEditedTailoredResumeInputV1Schema.safeParse(editValue);
  const parentVersion = z.string().uuid().safeParse(parentVersionId);
  if (parent.status !== "valid" || !parentVersion.success) {
    return { status: "invalid_parent" };
  }
  if (!edit.success) return { status: "invalid_document" };

  const parentEntries = indexParentEntries(parent.content);
  if (!parentEntries) return { status: "invalid_parent" };

  const editedEntries = new Map<
    string,
    TailoredResumeDocumentV1["sections"][number]["entries"][number]
  >();
  const retainedBullets = new Set<string>();

  for (const editedEntry of edit.data.entries) {
    const parentEntry = parentEntries.get(editedEntry.entryId);
    if (!parentEntry || editedEntries.has(editedEntry.entryId)) {
      return { status: "invalid_document" };
    }
    const parentBullets = new Map(
      parentEntry.entry.bullets.map((bullet) => [
        bullet.provenance.fragmentId,
        bullet,
      ]),
    );
    const bullets = [];
    for (const editedBullet of editedEntry.bullets) {
      const parentBullet = parentBullets.get(editedBullet.fragmentId);
      const bulletIdentity = `${editedEntry.entryId}:${editedBullet.fragmentId}`;
      if (!parentBullet || retainedBullets.has(bulletIdentity)) {
        return { status: "invalid_document" };
      }
      retainedBullets.add(bulletIdentity);
      bullets.push({
        text: editedBullet.text,
        provenance: { ...parentBullet.provenance },
      });
    }
    editedEntries.set(editedEntry.entryId, {
      heading: parentEntry.entry.heading,
      bullets,
    });
  }

  const document = {
    ...structuredClone(parent.content.document),
    sections: parent.content.document.sections.map((section) => ({
      ...structuredClone(section),
      entries: section.entries.flatMap((entry) => {
        const entryId = entry.bullets[0]?.provenance.entryId;
        const editedEntry = entryId ? editedEntries.get(entryId) : undefined;
        return editedEntry ? [editedEntry] : [];
      }),
    })),
  };
  const parsedDocument = tailoredResumeDocumentV1Schema.safeParse(document);
  if (!parsedDocument.success) return { status: "invalid_document" };

  const candidate = {
    contractVersion: USER_EDITED_TAILORED_RESUME_CONTENT_CONTRACT_VERSION,
    authorship: "user",
    parentVersionId: parentVersion.data,
    document: parsedDocument.data,
  };
  const content =
    userEditedTailoredResumeVersionContentV1Schema.safeParse(candidate);
  return content.success
    ? { status: "success", content: deepFreeze(content.data) }
    : { status: "invalid_document" };
}

export function parseUserEditedTailoredResumeVersionContent(value: unknown) {
  const parsed =
    userEditedTailoredResumeVersionContentV1Schema.safeParse(value);
  return parsed.success
    ? ({ status: "valid", content: deepFreeze(parsed.data) } as const)
    : ({ status: "invalid" } as const);
}
