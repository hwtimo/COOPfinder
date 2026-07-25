import "server-only";

/**
 * InternshipBC currently has no Supabase Storage buckets or object paths.
 * Guest drafts use browser localStorage and are not server-owned objects.
 * Keep this boundary explicit so account deletion never guesses bucket names.
 */
export const USER_OWNED_STORAGE_LOCATIONS = Object.freeze([]) as readonly [];

export async function removeOwnedStorageObjects(
  userId: string,
): Promise<boolean> {
  void userId;
  return USER_OWNED_STORAGE_LOCATIONS.length === 0;
}
