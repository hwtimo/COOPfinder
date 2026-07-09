import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "./server";

export async function getSupabaseUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) return null;

  return user;
}
