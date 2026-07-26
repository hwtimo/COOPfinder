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
  beforeSend: (event) => scrubSentryEvent(event, "node") as typeof event,
});
