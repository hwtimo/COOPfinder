import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

import { sanitizeMonitoringRoute } from "@/lib/monitoring/sentry-privacy";

export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    scope.setTags({
      route: sanitizeMonitoringRoute(context.routePath),
      route_type: context.routeType,
      runtime: process.env.NEXT_RUNTIME === "edge" ? "edge" : "node",
      status: "500",
    });
    Sentry.captureRequestError(error, request, context);
  });
};
