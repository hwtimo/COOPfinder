import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { GuestDraftImportHandoff } from "@/components/app/guest-draft-import-handoff";
import {
  buildAppShellUser,
  type AppShellProfile,
} from "@/lib/auth/app-shell-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  let profile: AppShellProfile | null = null;

  if (supabase && user) {
    const profileResult = await supabase
      .from("profiles")
      .select("full_name,school,program,coop_term")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profileResult.error) {
      profile = profileResult.data as AppShellProfile | null;
    }
  }

  const shellUser = buildAppShellUser(user, profile);

  return (
    <div className="min-h-dvh bg-background">
      <AppSidebar user={shellUser} />
      <div className="md:pl-60 print:pl-0">
        <AppTopbar user={shellUser} />
        <main className="mx-auto max-w-[1400px] px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 print:max-w-none print:p-0">
          {user ? <GuestDraftImportHandoff userId={user.id} /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
