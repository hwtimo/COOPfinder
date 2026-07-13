import { StartOnboarding } from "@/components/start/start-onboarding";
import { getSupabaseUser } from "@/lib/supabase/user";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const user = await getSupabaseUser();

  return <StartOnboarding isAuthenticated={Boolean(user)} />;
}
