import assert from "node:assert/strict";
import test from "node:test";

import {
  parseTailoringFinalizationRpcResult,
  parseTailoringRefundRpcResult,
  parseTailoringReservationRpcResult,
} from "../../lib/tailoring/tailoring-generation-reservation";

const RESERVATION_ID = "6892c5a6-387e-418a-b2c0-7f3561a65889";
const VERSION_ID = "741f62e0-9b28-4f31-aa18-9a1c1c613df8";
const EXPIRES_AT = "2026-07-20T20:10:00.000Z";

function reservationRow(
  resultStatus: string,
  overrides: Record<string, unknown> = {},
) {
  return [
    {
      result_status: resultStatus,
      reservation_id: null,
      resume_version_id: null,
      expires_at: null,
      ...overrides,
    },
  ];
}

test("strictly parses reservation lifecycle results", () => {
  assert.deepEqual(
    parseTailoringReservationRpcResult(
      reservationRow("reserved", {
        reservation_id: RESERVATION_ID,
        expires_at: EXPIRES_AT,
      }),
    ),
    {
      status: "reserved",
      reservationId: RESERVATION_ID,
      expiresAt: EXPIRES_AT,
    },
  );
  assert.deepEqual(
    parseTailoringReservationRpcResult(
      reservationRow("generation_in_progress", {
        reservation_id: RESERVATION_ID,
        expires_at: EXPIRES_AT,
      }),
    ),
    {
      status: "generation_in_progress",
      reservationId: RESERVATION_ID,
      expiresAt: EXPIRES_AT,
    },
  );
  assert.deepEqual(
    parseTailoringReservationRpcResult(
      reservationRow("already_completed", {
        reservation_id: RESERVATION_ID,
        resume_version_id: VERSION_ID,
        expires_at: EXPIRES_AT,
      }),
    ),
    {
      status: "already_completed",
      reservationId: RESERVATION_ID,
      resumeVersionId: VERSION_ID,
    },
  );
  for (const status of ["terminal_refunded", "terminal_expired"] as const) {
    assert.deepEqual(
      parseTailoringReservationRpcResult(
        reservationRow(status, {
          reservation_id: RESERVATION_ID,
          expires_at: EXPIRES_AT,
        }),
      ),
      { status, reservationId: RESERVATION_ID },
    );
  }
  for (const status of [
    "insufficient_credit",
    "rate_limited",
    "not_found",
    "invalid_input",
  ] as const) {
    assert.deepEqual(parseTailoringReservationRpcResult(reservationRow(status)), {
      status,
    });
  }
});

test("strictly parses refund lifecycle results", () => {
  for (const status of ["refunded", "already_refunded", "expired"] as const) {
    assert.deepEqual(
      parseTailoringRefundRpcResult([
        {
          result_status: status,
          reservation_id: RESERVATION_ID,
          resume_version_id: null,
        },
      ]),
      { status, reservationId: RESERVATION_ID },
    );
  }
  assert.deepEqual(
    parseTailoringRefundRpcResult([
      {
        result_status: "already_completed",
        reservation_id: RESERVATION_ID,
        resume_version_id: VERSION_ID,
      },
    ]),
    {
      status: "already_completed",
      reservationId: RESERVATION_ID,
      resumeVersionId: VERSION_ID,
    },
  );
  for (const status of ["not_found", "invalid_input"] as const) {
    assert.deepEqual(
      parseTailoringRefundRpcResult([
        {
          result_status: status,
          reservation_id: null,
          resume_version_id: null,
        },
      ]),
      { status },
    );
  }
});

test("strictly parses atomic finalization and replay results", () => {
  for (const status of ["finalized", "already_completed"] as const) {
    assert.deepEqual(
      parseTailoringFinalizationRpcResult([
        {
          result_status: status,
          reservation_id: RESERVATION_ID,
          resume_version_id: VERSION_ID,
          version_name: `Developer - tailored v1 - ${RESERVATION_ID}`,
        },
      ]),
      {
        status,
        reservationId: RESERVATION_ID,
        resumeVersionId: VERSION_ID,
        versionName: `Developer - tailored v1 - ${RESERVATION_ID}`,
      },
    );
  }
  for (const status of [
    "terminal_refunded",
    "expired",
    "invalid_output",
  ] as const) {
    assert.deepEqual(
      parseTailoringFinalizationRpcResult([
        {
          result_status: status,
          reservation_id: RESERVATION_ID,
          resume_version_id: null,
          version_name: null,
        },
      ]),
      { status, reservationId: RESERVATION_ID },
    );
  }
});

test("malformed, unknown, multi-row, and extra-field responses fail closed", () => {
  for (const value of [
    null,
    [],
    [{}, {}],
    reservationRow("unknown"),
    reservationRow("reserved", {
      reservation_id: "not-a-uuid",
      expires_at: EXPIRES_AT,
    }),
    reservationRow("reserved", {
      reservation_id: RESERVATION_ID,
      expires_at: "not-a-time",
      private_detail: "must not be accepted",
    }),
  ]) {
    assert.deepEqual(parseTailoringReservationRpcResult(value), {
      status: "unavailable",
    });
  }

  assert.deepEqual(
    parseTailoringRefundRpcResult([
      {
        result_status: "refunded",
        reservation_id: RESERVATION_ID,
        resume_version_id: null,
        extra: true,
      },
    ]),
    { status: "unavailable" },
  );
  assert.deepEqual(
    parseTailoringFinalizationRpcResult([
      {
        result_status: "finalized",
        reservation_id: RESERVATION_ID,
        resume_version_id: VERSION_ID,
        version_name: "  unnormalized  ",
      },
    ]),
    { status: "unavailable" },
  );
});

test("result parsers expose no provider, database, route, or UI dependency", () => {
  assert.equal(parseTailoringReservationRpcResult.length, 1);
  assert.equal(parseTailoringRefundRpcResult.length, 1);
  assert.equal(parseTailoringFinalizationRpcResult.length, 1);
});
