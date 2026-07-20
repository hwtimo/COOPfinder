import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseUser } from "@/lib/supabase/user";

export type CurrentTailoringCreditBalanceResult =
  | Readonly<{ status: "ready"; available: number }>
  | Readonly<{ status: "unauthenticated" | "unavailable" }>;

type BalanceRowsResult =
  | Readonly<{
      status: "ready";
      ledgerAmounts: readonly unknown[];
      activeReservationCount: number;
    }>
  | Readonly<{ status: "unavailable" }>;

export type CurrentTailoringCreditBalanceDependencies = Readonly<{
  getAuthenticatedUser: () => Promise<Readonly<{ id: string }> | null>;
  getBalanceRows: (userId: string) => Promise<BalanceRowsResult>;
}>;

export function createCurrentTailoringCreditBalanceLoader(
  dependencies: CurrentTailoringCreditBalanceDependencies,
): () => Promise<CurrentTailoringCreditBalanceResult> {
  return async function loadCurrentTailoringCreditBalance() {
    let user: Readonly<{ id: string }> | null;
    try {
      user = await dependencies.getAuthenticatedUser();
    } catch {
      return { status: "unavailable" };
    }
    if (!user) return { status: "unauthenticated" };

    let rows: BalanceRowsResult;
    try {
      rows = await dependencies.getBalanceRows(user.id);
    } catch {
      return { status: "unavailable" };
    }
    if (rows.status !== "ready") return rows;
    if (
      !Number.isSafeInteger(rows.activeReservationCount) ||
      rows.activeReservationCount < 0
    ) {
      return { status: "unavailable" };
    }

    let settled = 0;
    for (const amount of rows.ledgerAmounts) {
      if (!Number.isSafeInteger(amount)) return { status: "unavailable" };
      settled += amount as number;
      if (!Number.isSafeInteger(settled)) return { status: "unavailable" };
    }
    return {
      status: "ready",
      available: Math.max(0, settled - rows.activeReservationCount),
    };
  };
}

const productionLoader = createCurrentTailoringCreditBalanceLoader({
  async getAuthenticatedUser() {
    const user = await getSupabaseUser();
    return user ? { id: user.id } : null;
  },
  async getBalanceRows(userId) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { status: "unavailable" };
    const now = new Date().toISOString();
    const [ledger, reservations] = await Promise.all([
      supabase
        .from("tailoring_credit_ledger")
        .select("amount")
        .eq("user_id", userId),
      supabase
        .from("tailoring_generation_reservations")
        .select("id")
        .eq("user_id", userId)
        .eq("state", "reserved")
        .gt("expires_at", now),
    ]);
    if (ledger.error || reservations.error) return { status: "unavailable" };
    return {
      status: "ready",
      ledgerAmounts: (ledger.data ?? []).map((row) => row.amount),
      activeReservationCount: reservations.data?.length ?? 0,
    };
  },
});

export async function getCurrentTailoringCreditBalance(): Promise<CurrentTailoringCreditBalanceResult> {
  return productionLoader();
}
