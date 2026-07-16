import assert from "node:assert/strict";
import test from "node:test";

import {
  intakeSourceAfterManualEdit,
  isPreparedForJobAnalysis,
  MANUAL_JOB_DESCRIPTION_EXPLANATION,
  normalizeJobUrl,
  preparePrivateJobIntake,
  requiresManualJobDescription,
} from "../../lib/jobs/job-url-intake";

test("accepts and normalizes public HTTPS URLs", () => {
  assert.deepEqual(normalizeJobUrl("https://careers.example.com/jobs/123"), {
    status: "success",
    normalizedUrl: "https://careers.example.com/jobs/123",
  });
});

test("accepts public HTTP URLs and removes the default port", () => {
  assert.deepEqual(normalizeJobUrl("http://jobs.example.ca:80/role"), {
    status: "success",
    normalizedUrl: "http://jobs.example.ca/role",
  });
});

test("normalizes scheme and hostname, removes fragments and tracking, and sorts query parameters", () => {
  assert.deepEqual(
    normalizeJobUrl(
      "HTTPS://CAREERS.EXAMPLE.COM:443/jobs?b=2&utm_source=news&a=1&fbclid=tracking#apply",
    ),
    {
      status: "success",
      normalizedUrl: "https://careers.example.com/jobs?a=1&b=2",
    },
  );
});

for (const trackingKey of [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
]) {
  test(`removes ${trackingKey} case-insensitively`, () => {
    assert.deepEqual(
      normalizeJobUrl(
        `https://jobs.example.ca/role?keep=1&${trackingKey.toUpperCase()}=private`,
      ),
      {
        status: "success",
        normalizedUrl: "https://jobs.example.ca/role?keep=1",
      },
    );
  });
}

test("rejects malformed and missing-host URLs", () => {
  assert.deepEqual(normalizeJobUrl("not a URL"), { status: "invalid_url" });
  assert.deepEqual(normalizeJobUrl("https://"), { status: "invalid_url" });
});

test("rejects non-HTTP protocols", () => {
  assert.deepEqual(normalizeJobUrl("ftp://jobs.example.ca/role"), {
    status: "unsupported_protocol",
  });
});

test("rejects embedded credentials", () => {
  assert.deepEqual(normalizeJobUrl("https://user:pass@jobs.example.ca/role"), {
    status: "credentials_not_allowed",
  });
});

for (const hostname of ["localhost", "jobs.localhost"]) {
  test(`rejects unsafe local hostname ${hostname}`, () => {
    assert.deepEqual(normalizeJobUrl(`https://${hostname}/role`), {
      status: "unsafe_host",
    });
  });
}

for (const address of [
  "127.0.0.1",
  "10.1.2.3",
  "172.16.0.1",
  "172.31.255.255",
  "192.168.1.1",
  "169.254.10.20",
  "127.1",
  "2130706433",
]) {
  test(`rejects unsafe IPv4 literal ${address}`, () => {
    assert.deepEqual(normalizeJobUrl(`http://${address}/role`), {
      status: "unsafe_host",
    });
  });
}

for (const address of [
  "::1",
  "::127.0.0.1",
  "::ffff:127.0.0.1",
  "fc00::1",
  "fd12:3456::1",
  "fe80::1",
]) {
  test(`rejects unsafe IPv6 literal ${address}`, () => {
    assert.deepEqual(normalizeJobUrl(`https://[${address}]/role`), {
      status: "unsafe_host",
    });
  });
}

test("rejects explicit non-default ports", () => {
  assert.deepEqual(normalizeJobUrl("https://jobs.example.ca:8443/role"), {
    status: "unsupported_port",
  });
  assert.deepEqual(normalizeJobUrl("http://jobs.example.ca:443/role"), {
    status: "unsupported_port",
  });
});

for (const key of [
  "token",
  "access_token",
  "auth",
  "authorization",
  "password",
  "passwd",
  "secret",
  "session",
  "sessionid",
  "api_key",
  "apikey",
]) {
  test(`rejects sensitive query key ${key} case-insensitively`, () => {
    assert.deepEqual(
      normalizeJobUrl(
        `https://jobs.example.ca/role?${key.toUpperCase()}=do-not-return`,
      ),
      { status: "sensitive_query_not_allowed" },
    );
  });
}

test("prepares URL-only creation without fabricating raw text", () => {
  assert.deepEqual(
    preparePrivateJobIntake({
      sourceUrl:
        "HTTPS://JOBS.EXAMPLE.CA:443/role?utm_campaign=coop&posting=42#apply",
      rawText: "",
    }),
    {
      status: "success",
      sourceUrl: "https://jobs.example.ca/role?posting=42",
      rawText: null,
      intakeSource: "pasted_url",
    },
  );
});

test("preserves pasted-text creation and prefers valid manual text when URL is also supplied", () => {
  assert.deepEqual(
    preparePrivateJobIntake({ sourceUrl: "", rawText: "  Manual JD  " }),
    {
      status: "success",
      sourceUrl: null,
      rawText: "Manual JD",
      intakeSource: "pasted_text",
    },
  );
  assert.deepEqual(
    preparePrivateJobIntake({
      sourceUrl: "https://jobs.example.ca/role#apply",
      rawText: "  Manual JD  ",
    }),
    {
      status: "success",
      sourceUrl: "https://jobs.example.ca/role",
      rawText: "Manual JD",
      intakeSource: "pasted_text",
    },
  );
});

test("rejected creation input returns no persistable payload", () => {
  assert.deepEqual(
    preparePrivateJobIntake({
      sourceUrl: "https://localhost/role",
      rawText: "Manual JD",
    }),
    { status: "unsafe_host" },
  );
});

test("manual text reclassifies only pasted_url jobs", () => {
  assert.equal(
    intakeSourceAfterManualEdit("pasted_url", "Manual JD"),
    "pasted_text",
  );
  assert.equal(
    intakeSourceAfterManualEdit("board_save", "Manual JD"),
    "board_save",
  );
  assert.equal(intakeSourceAfterManualEdit("manual", "Manual JD"), "manual");
  assert.equal(
    intakeSourceAfterManualEdit("pasted_url", "   "),
    "pasted_url",
  );
});

test("URL-only UI requires manual text and transition makes Analyze reachable", () => {
  assert.equal(requiresManualJobDescription("pasted_url", null), true);
  assert.equal(isPreparedForJobAnalysis("pasted_url", null), false);
  assert.equal(requiresManualJobDescription("pasted_text", "Manual JD"), false);
  assert.equal(isPreparedForJobAnalysis("pasted_text", "Manual JD"), true);
  assert.match(MANUAL_JOB_DESCRIPTION_EXPLANATION, /not currently supported/i);
  assert.doesNotMatch(MANUAL_JOB_DESCRIPTION_EXPLANATION, /fetching|scraping/i);
});
