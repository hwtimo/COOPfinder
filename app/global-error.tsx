"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { sanitizeMonitoringRoute } from "@/lib/monitoring/sentry-privacy";

export default function GlobalError({
  error,
  unstable_retry,
}: Readonly<{
  error: Error & { digest?: string };
  unstable_retry: () => void;
}>) {
  useEffect(() => {
    Sentry.withScope((scope) => {
      scope.setTags({
        route: sanitizeMonitoringRoute(window.location.pathname),
        route_type: "render",
        runtime: "browser",
        status: "500",
      });
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
          <section className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-semibold">This page couldn&apos;t load</h1>
            <p className="text-sm text-muted-foreground">
              Try the request again. If the problem continues, return to the
              previous page.
            </p>
            <Button type="button" onClick={() => unstable_retry()}>
              Try again
            </Button>
          </section>
        </main>
      </body>
    </html>
  );
}
