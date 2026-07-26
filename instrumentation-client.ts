import * as Sentry from "@sentry/nextjs";

import {
  filterPrivacyUnsafeIntegrations,
  SENTRY_DATA_COLLECTION,
  scrubSentryEvent,
} from "@/lib/monitoring/sentry-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  dataCollection: SENTRY_DATA_COLLECTION,
  enableLogs: false,
  integrations: filterPrivacyUnsafeIntegrations,
  beforeSend: (event) =>
    scrubSentryEvent(
      {
        ...event,
        tags: {
          ...event.tags,
          route: window.location.pathname,
          route_type: event.tags?.route_type ?? "client",
          status: event.tags?.status ?? "500",
        },
      },
      "browser",
    ) as typeof event,
});
