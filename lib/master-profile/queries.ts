import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  MasterProfileData,
  MasterProfileEntry,
  MasterProfileSection,
} from "./types";

type ProfileRow = {
  full_name: string | null;
  school: string | null;
  program: string | null;
  grad_year: number | null;
  coop_term: string | null;
  work_authorization: string | null;
  preferred_locations: string[] | null;
  target_roles: string[] | null;
};

type MasterRow = { data: unknown };

type EntryRow = {
  id: string;
  section: MasterProfileSection;
  source_label: string | null;
  title: string | null;
  entry_text: string;
  skills: string[] | null;
  confirmed: boolean;
  sort_order: number;
};

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function storedSkills(value: unknown): string[] {
  const skills = recordValue(value).skills;
  return Array.isArray(skills)
    ? skills.filter((skill): skill is string => typeof skill === "string")
    : [];
}

function toEntry(row: EntryRow): MasterProfileEntry {
  return {
    id: row.id,
    section: row.section,
    source: row.source_label || row.title || "Untitled entry",
    text: row.entry_text,
    skills: row.skills ?? [],
    confirmed: row.confirmed,
    sortOrder: row.sort_order,
  };
}

export async function getMasterProfile(
  userId: string,
  email: string,
): Promise<{ status: "ready" | "error"; data: MasterProfileData }> {
  const empty: MasterProfileData = {
    fullName: "",
    email,
    school: "",
    program: "",
    gradYear: "",
    coopTerm: "",
    workAuthorization: "",
    preferredLocations: [],
    targetRoles: [],
    skills: [],
    entries: [],
  };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: empty };

  const [profileResult, masterResult, entriesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name,school,program,grad_year,coop_term,work_authorization,preferred_locations,target_roles",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("master_profiles")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("master_profile_entries")
      .select(
        "id,section,source_label,title,entry_text,skills,confirmed,sort_order",
      )
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (profileResult.error || masterResult.error || entriesResult.error) {
    return { status: "error", data: empty };
  }

  const profile = profileResult.data as ProfileRow | null;
  const master = masterResult.data as MasterRow | null;

  return {
    status: "ready",
    data: {
      fullName: profile?.full_name ?? "",
      email,
      school: profile?.school ?? "",
      program: profile?.program ?? "",
      gradYear: profile?.grad_year ? String(profile.grad_year) : "",
      coopTerm: profile?.coop_term ?? "",
      workAuthorization: profile?.work_authorization ?? "",
      preferredLocations: profile?.preferred_locations ?? [],
      targetRoles: profile?.target_roles ?? [],
      skills: storedSkills(master?.data),
      entries: ((entriesResult.data ?? []) as EntryRow[]).map(toEntry),
    },
  };
}
