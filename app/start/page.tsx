import { StartOnboarding } from "@/components/start/start-onboarding";
import { getPublicBoardJobs } from "@/lib/board/queries";
import { getSupabaseUser } from "@/lib/supabase/user";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const [user, boardResult] = await Promise.all([
    getSupabaseUser(),
    getPublicBoardJobs(),
  ]);

  return (
    <StartOnboarding
      isAuthenticated={Boolean(user)}
      boardJobs={boardResult.status === "ready" ? boardResult.data : []}
      boardAvailable={boardResult.status === "ready"}
    />
  );
}
