import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createCurrentTailoringCreditBalanceLoader } from "../../lib/tailoring/get-current-tailoring-credit-balance";

const USER_ID = "a71a0000-0000-4000-8000-000000000001";

test("returns settled credits minus active unexpired reservations", async () => {
  const loader = createCurrentTailoringCreditBalanceLoader({
    async getAuthenticatedUser() {
      return { id: USER_ID };
    },
    async getBalanceRows(userId) {
      assert.equal(userId, USER_ID);
      return {
        status: "ready",
        ledgerAmounts: [2, 3, -1],
        activeReservationCount: 1,
      };
    },
  });
  assert.deepEqual(await loader(), { status: "ready", available: 3 });
});

test("clamps display at zero and fails closed on malformed rows", async () => {
  const negative = createCurrentTailoringCreditBalanceLoader({
    async getAuthenticatedUser() { return { id: USER_ID }; },
    async getBalanceRows() {
      return { status: "ready", ledgerAmounts: [-1], activeReservationCount: 2 };
    },
  });
  assert.deepEqual(await negative(), { status: "ready", available: 0 });

  for (const ledgerAmounts of [[1.5], ["2"], [Number.MAX_SAFE_INTEGER, 1]]) {
    const invalid = createCurrentTailoringCreditBalanceLoader({
      async getAuthenticatedUser() { return { id: USER_ID }; },
      async getBalanceRows() {
        return { status: "ready", ledgerAmounts, activeReservationCount: 0 };
      },
    });
    assert.deepEqual(await invalid(), { status: "unavailable" });
  }
});

test("authentication and query failures remain safe", async () => {
  const unauthenticated = createCurrentTailoringCreditBalanceLoader({
    async getAuthenticatedUser() { return null; },
    async getBalanceRows() { throw new Error("must not run"); },
  });
  assert.deepEqual(await unauthenticated(), { status: "unauthenticated" });

  const unavailable = createCurrentTailoringCreditBalanceLoader({
    async getAuthenticatedUser() { return { id: USER_ID }; },
    async getBalanceRows() { return { status: "unavailable" }; },
  });
  assert.deepEqual(await unavailable(), { status: "unavailable" });
});

test("production balance is request-bound, owner-filtered, read-only, and invokes no lifecycle RPC", () => {
  const source = readFileSync("lib/tailoring/get-current-tailoring-credit-balance.ts", "utf8");
  assert.match(source, /^import "server-only";/);
  assert.match(source, /getSupabaseUser/);
  assert.match(source, /createSupabaseServerClient/);
  assert.match(source, /\.from\("tailoring_credit_ledger"\)/);
  assert.match(source, /\.from\("tailoring_generation_reservations"\)/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(source, /\.eq\("state", "reserved"\)/);
  assert.match(source, /\.gt\("expires_at", now\)/);
  assert.doesNotMatch(source, /\.rpc\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.doesNotMatch(source, /createSupabaseAdminClient|service[_-]?role|OpenAI|provider/i);
});
