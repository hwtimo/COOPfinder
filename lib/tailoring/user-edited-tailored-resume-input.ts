import { z } from "zod";

type Primitive = string | number | boolean | bigint | symbol | null | undefined;
type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : { readonly [Key in keyof T]: DeepReadonly<T[Key]> };

export const USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION =
  "user-edited-tailored-resume-input-v1" as const;

const normalizedIdentifier = z
  .string()
  .min(1)
  .max(32)
  .refine((value) => value.replace(/\s+/g, " ").trim() === value);

const normalizedBulletText = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1).max(500));

const editedBulletSchema = z
  .object({
    fragmentId: normalizedIdentifier,
    text: normalizedBulletText,
  })
  .strict();

const editedEntrySchema = z
  .object({
    entryId: normalizedIdentifier,
    bullets: z.array(editedBulletSchema).min(1).max(20),
  })
  .strict();

export const userEditedTailoredResumeInputV1Schema = z
  .object({
    contractVersion: z.literal(
      USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
    ),
    entries: z.array(editedEntrySchema).min(1).max(160),
  })
  .strict();

export type UserEditedTailoredResumeInputV1 = DeepReadonly<
  z.infer<typeof userEditedTailoredResumeInputV1Schema>
>;
