import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
  suppressOnRouterTransitionStartWarning: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
