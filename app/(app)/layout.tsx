import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { currentUser } from "@/lib/mock";
import { getSupabaseUser } from "@/lib/supabase/user";

export const dynamic = "force-dynamic";

function getInitials(label: string): string {
  const parts = label
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "U";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSupabaseUser();
  const email = user?.email ?? "";
  const metadataName = user?.user_metadata?.full_name;
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName
      : email
        ? email.split("@")[0]
        : currentUser.name;
  const shellUser = user
    ? {
        name,
        email,
        initials: getInitials(name || email),
        meta: email || `${currentUser.school} · ${currentUser.program}`,
      }
    : null;

  return (
    <div className="min-h-dvh bg-background">
      <AppSidebar user={shellUser} />
      <div className="md:pl-60">
        <AppTopbar user={shellUser} />
        <main className="mx-auto max-w-[1400px] px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
