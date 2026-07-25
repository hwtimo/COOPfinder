import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildSettingsAccount,
  type SettingsAccount,
  type SettingsProfileRow,
} from "./account-summary";

export type SettingsAccountResult =
  | Readonly<{ status: "ready"; account: SettingsAccount }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "unavailable" }>;

export async function getSettingsAccount(): Promise<SettingsAccountResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unavailable" };

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) return { status: "unauthenticated" };

  const profileResult = await supabase
    .from("profiles")
    .select("full_name,school,program,coop_term")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileResult.error) return { status: "unavailable" };

  return {
    status: "ready",
    account: buildSettingsAccount(
      user,
      profileResult.data as SettingsProfileRow | null,
    ),
  };
}
