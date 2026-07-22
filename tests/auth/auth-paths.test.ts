import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthCallbackUrl,
  buildPasswordResetCallbackUrl,
  resolveAuthOrigin,
  sanitizeLoginReason,
  sanitizeNextPath,
} from "../../lib/auth/paths";

test("production auth URLs always use the canonical domain", () => {
  assert.equal(
    buildAuthCallbackUrl(
      "https://coopfinder.vercel.app",
      "/jobs/123?tab=match",
      "save_job",
      "production",
    ),
    "https://internshipbc.dev/auth/callback?next=%2Fjobs%2F123%3Ftab%3Dmatch&reason=save_job",
  );
  assert.equal(
    resolveAuthOrigin("https://preview.example", "production"),
    "https://internshipbc.dev",
  );
});

test("development permits only a loopback auth origin", () => {
  assert.equal(
    buildAuthCallbackUrl(
      "http://localhost:3000/ignored",
      "/dashboard",
      undefined,
      "development",
    ),
    "http://localhost:3000/auth/callback?next=%2Fdashboard",
  );
  assert.equal(
    resolveAuthOrigin("https://preview.example", "development"),
    "https://internshipbc.dev",
  );
});

test("callback, reset, next, and reason handling reject unsafe values", () => {
  assert.equal(sanitizeNextPath("https://evil.example/path"), "/dashboard");
  assert.equal(sanitizeNextPath("//evil.example/path"), "/dashboard");
  assert.equal(sanitizeNextPath("/auth/callback"), "/dashboard");
  assert.equal(sanitizeLoginReason("save_job"), "save_job");
  assert.equal(sanitizeLoginReason("javascript:alert(1)"), undefined);
  assert.equal(
    buildPasswordResetCallbackUrl(
      "https://coopfinder.vercel.app",
      "//evil.example",
      "production",
    ),
    "https://internshipbc.dev/auth/callback?next=%2Freset-password%3Fnext%3D%252Fdashboard",
  );
});
