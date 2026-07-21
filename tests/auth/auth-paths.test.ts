import assert from "node:assert/strict";
import test from "node:test";

import { buildAuthCallbackUrl, sanitizeNextPath } from "../../lib/auth/paths";

test("callback URL uses the current safe origin and encoded next path", () => {
  assert.equal(
    buildAuthCallbackUrl("http://localhost:3000/ignored", "/jobs/123?tab=match"),
    "http://localhost:3000/auth/callback?next=%2Fjobs%2F123%3Ftab%3Dmatch",
  );
  assert.equal(
    buildAuthCallbackUrl("https://internshipbc.dev", "/dashboard"),
    "https://internshipbc.dev/auth/callback?next=%2Fdashboard",
  );
  assert.equal(
    buildAuthCallbackUrl("https://coopfinder.vercel.app", "/dashboard"),
    "https://coopfinder.vercel.app/auth/callback?next=%2Fdashboard",
  );
});

test("callback construction and next handling reject unsafe values", () => {
  assert.equal(sanitizeNextPath("https://evil.example/path"), "/dashboard");
  assert.equal(sanitizeNextPath("//evil.example/path"), "/dashboard");
  assert.equal(sanitizeNextPath("/auth/callback"), "/dashboard");
  assert.equal(
    buildAuthCallbackUrl("javascript:alert(1)", "//evil.example"),
    "http://localhost:3000/auth/callback?next=%2Fdashboard",
  );
});
