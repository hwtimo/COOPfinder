import { redirect } from "next/navigation";

import { getSupabaseUser } from "@/lib/supabase/user";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await getSupabaseUser();

  redirect(user ? "/dashboard" : "/start");
}
