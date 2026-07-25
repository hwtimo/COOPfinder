export const ACCOUNT_DELETE_CONFIRMATION = "DELETE";

export type DeleteCurrentAccountResult =
  | Readonly<{ status: "deleted" }>
  | Readonly<{ status: "invalid_confirmation" }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "storage_unavailable" }>
  | Readonly<{ status: "account_unavailable" }>
  | Readonly<{ status: "session_unavailable" }>;

type AuthenticatedUser = Readonly<{ id: string }>;

export type DeleteCurrentAccountDependencies = Readonly<{
  getAuthenticatedUser: () => Promise<AuthenticatedUser | null>;
  removeOwnedStorageObjects: (userId: string) => Promise<boolean>;
  deleteAuthUser: (userId: string) => Promise<boolean>;
  clearSession: () => Promise<boolean>;
}>;

export async function deleteCurrentAccount(
  confirmation: unknown,
  dependencies: DeleteCurrentAccountDependencies,
): Promise<DeleteCurrentAccountResult> {
  if (confirmation !== ACCOUNT_DELETE_CONFIRMATION) {
    return { status: "invalid_confirmation" };
  }
  const user = await dependencies.getAuthenticatedUser();
  if (!user) return { status: "unauthenticated" };
  if (!(await dependencies.removeOwnedStorageObjects(user.id))) {
    return { status: "storage_unavailable" };
  }
  if (!(await dependencies.deleteAuthUser(user.id))) {
    return { status: "account_unavailable" };
  }
  if (!(await dependencies.clearSession())) {
    return { status: "session_unavailable" };
  }
  return { status: "deleted" };
}
