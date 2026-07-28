import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filterPrivacyUnsafeIntegrations,
  sanitizeMonitoringRoute,
  SENTRY_DATA_COLLECTION,
  type SentryEventLike,
  scrubSentryEvent,
} from "../../lib/monitoring/sentry-privacy";

test("scrubs personal, authentication, request, AI, and content fields", () => {
  const event = scrubSentryEvent(
    {
      event_id: "safe-event-id",
      message: "password=secret profile@example.com",
      user: { id: "owner-id", email: "profile@example.com" },
      request: {
        url: "https://internshipbc.dev/jobs/private-id?token=secret",
        headers: { cookie: "session=secret", authorization: "Bearer secret" },
        data: { raw_text: "private job description" },
      },
      breadcrumbs: [
        { category: "console", message: "private resume content" },
      ],
      extra: {
        prompt: "private AI prompt",
        profile: "private profile body",
        resume: "private resume body",
        password: "secret",
        token: "secret",
      },
      contexts: {
        nextjs: {
          request_path: "/jobs/private-id?access_token=secret",
        },
      },
      tags: {
        route:
          "/jobs/123e4567-e89b-12d3-a456-426614174000?token=secret",
        route_type: "action",
        runtime: "attacker-controlled",
        status: 500,
        email: "profile@example.com",
        user_id: "owner-id",
      },
      transaction:
        "/jobs/123e4567-e89b-12d3-a456-426614174000?token=secret",
      exception: {
        values: [
          {
            type: "Error",
            value: "private job and resume content",
            mechanism: { data: { password: "secret" } },
            stacktrace: {
              frames: [
                {
                  filename:
                    "C:\\Users\\private\\.next\\server\\app\\jobs\\page.js?token=secret",
                  function: "renderJob",
                  lineno: 10,
                  colno: 4,
                  in_app: true,
                  vars: { raw_text: "private job description" },
                },
              ],
            },
          },
        ],
      },
    } as unknown as SentryEventLike,
    "node",
  );

  const serialized = JSON.stringify(event);
  for (const sensitive of [
    "profile@example.com",
    "private job",
    "private profile",
    "private resume",
    "private AI prompt",
    "password",
    "Bearer",
    "cookie",
    "access_token",
    "owner-id",
    "secret",
  ]) {
    assert.equal(serialized.includes(sensitive), false, sensitive);
  }

  assert.deepEqual(event.tags, {
    route: "/jobs/[id]",
    route_type: "action",
    runtime: "node",
    status: "500",
  });
  assert.equal(event.transaction, "/jobs/[id]");
  assert.equal(event.type, undefined);
  assert.deepEqual(event.exception, {
    values: [
      {
        type: "Error",
        stacktrace: {
          frames: [
            {
              filename: ".next/server/app/jobs/page.js",
              function: "renderJob",
              lineno: 10,
              colno: 4,
              in_app: true,
            },
          ],
        },
      },
    ],
  });
});

test("normalizes routes without retaining query strings or opaque IDs", () => {
  assert.equal(
    sanitizeMonitoringRoute(
      "/applications/123e4567-e89b-12d3-a456-426614174000?code=secret",
    ),
    "/applications/[id]",
  );
  assert.equal(
    sanitizeMonitoringRoute("/accounts/profile%40example.com"),
    "/accounts/[id]",
  );
  assert.equal(sanitizeMonitoringRoute("https://example.com/private"), "unknown");
});

test("disables every sensitive data-collection category", () => {
  assert.deepEqual(SENTRY_DATA_COLLECTION, {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    stackFrameVariables: false,
    frameContextLines: 0,
  });
});

test("removes console, request, source-context, local-variable, and AI integrations", () => {
  const integrations = [
    "Breadcrumbs",
    "Console",
    "ContextLines",
    "GlobalHandlers",
    "Http",
    "LocalVariables",
    "OpenAI",
    "RequestData",
    "VercelAI",
  ].map((name) => ({ name }));

  assert.deepEqual(
    filterPrivacyUnsafeIntegrations(integrations).map(({ name }) => name),
    ["GlobalHandlers"],
  );
});

test("foundation wires client and server errors without replay, tracing, or logs", () => {
  const sources = [
    "instrumentation-client.ts",
    "instrumentation.ts",
    "sentry.server.config.ts",
    "sentry.edge.config.ts",
    "app/global-error.tsx",
  ].map((path) => readFileSync(path, "utf8"));
  const combined = sources.join("\n");

  assert.match(combined, /captureRequestError/);
  assert.match(combined, /captureException/);
  assert.match(combined, /NEXT_PUBLIC_SENTRY_DSN/);
  assert.match(combined, /window\.location\.pathname/);
  assert.match(combined, /enableLogs: false/);
  assert.doesNotMatch(
    combined,
    /replayIntegration|profilesSampleRate|tracesSampleRate|tracesSampler|consoleIntegration/,
  );
});
