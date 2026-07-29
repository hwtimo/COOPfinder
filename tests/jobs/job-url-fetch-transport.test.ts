import assert from "node:assert/strict";
import test from "node:test";

import {
  createJobUrlFetchTransport,
  extractReadableJobText,
  JOB_URL_FETCH_MAX_RESPONSE_BYTES,
  JOB_URL_FETCH_MAX_TEXT_CHARACTERS,
} from "../../lib/jobs/job-url-fetch-transport";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";
const PUBLIC_V4 = { address: "93.184.216.34", family: 4 as const };

function handler(overrides: {
  sourceUrl?: string | null;
  addresses?: Array<{ address: string; family: 4 | 6 }>;
  response?: {
    status: "response";
    statusCode: number;
    headers: Record<string, string | undefined>;
    body: Buffer;
  } | { status: "timeout" | "oversized_body" | "network_failure" };
} = {}) {
  const calls = { source: 0, dns: 0, request: 0 };
  const fetchJobUrl = createJobUrlFetchTransport({
    async getOwnedSource(jobId) {
      calls.source += 1;
      assert.equal(jobId, JOB_ID);
      return {
        status: "ready" as const,
        sourceUrl:
          "sourceUrl" in overrides
            ? (overrides.sourceUrl ?? null)
            : "https://jobs.example.com/role",
      };
    },
    async resolveHostname(hostname) {
      calls.dns += 1;
      assert.equal(hostname, "jobs.example.com");
      return overrides.addresses ?? [PUBLIC_V4];
    },
    async requestOnce(url, address) {
      calls.request += 1;
      assert.equal(url.toString(), "https://jobs.example.com/role");
      assert.deepEqual(address, PUBLIC_V4);
      return (
        overrides.response ?? {
          status: "response" as const,
          statusCode: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
          body: Buffer.from(
            "<main><h1>Engineer</h1><script>secret()</script><style>.x{}</style><p>Build &amp; test</p></main>",
          ),
        }
      );
    },
  });
  return { fetchJobUrl, calls };
}

test("loads one owned URL, resolves once, requests once, and extracts readable HTML", async () => {
  const { fetchJobUrl, calls } = handler();
  assert.deepEqual(await fetchJobUrl(JOB_ID), {
    status: "success",
    text: "Engineer Build & test",
  });
  assert.deepEqual(calls, { source: 1, dns: 1, request: 1 });
});

test("plain text is normalized deterministically", () => {
  const body = Buffer.from("  Senior\tEngineer\r\n\nBuild APIs  ");
  assert.equal(
    extractReadableJobText(body, "text/plain"),
    "Senior Engineer Build APIs",
  );
  assert.equal(
    extractReadableJobText(body, "text/plain"),
    extractReadableJobText(body, "text/plain"),
  );
});

test("invalid IDs and unavailable ownership states do not resolve or request URLs", async () => {
  for (const contextStatus of [
    "unauthenticated",
    "job_unavailable",
    "unavailable",
  ] as const) {
    let dns = 0;
    let request = 0;
    const fetchJobUrl = createJobUrlFetchTransport({
      async getOwnedSource() {
        return { status: contextStatus };
      },
      async resolveHostname() {
        dns += 1;
        return [PUBLIC_V4];
      },
      async requestOnce() {
        request += 1;
        return { status: "network_failure" };
      },
    });
    assert.deepEqual(await fetchJobUrl(JOB_ID), {
      status:
        contextStatus === "unavailable"
          ? "transport_unavailable"
          : contextStatus,
    });
    assert.equal(dns, 0);
    assert.equal(request, 0);
  }

  const { fetchJobUrl, calls } = handler();
  assert.deepEqual(await fetchJobUrl("not-a-job-id"), {
    status: "job_unavailable",
  });
  assert.deepEqual(calls, { source: 0, dns: 0, request: 0 });
});

test("missing or rejected saved URLs fail closed before DNS", async () => {
  for (const sourceUrl of [
    null,
    "ftp://jobs.example.com/role",
    "https://user:pass@jobs.example.com/role",
    "https://localhost/role",
    "https://jobs.example.com:8443/role",
  ]) {
    const { fetchJobUrl, calls } = handler({ sourceUrl });
    assert.deepEqual(await fetchJobUrl(JOB_ID), {
      status: sourceUrl === null ? "source_unavailable" : "blocked_url",
    });
    assert.equal(calls.dns, 0);
    assert.equal(calls.request, 0);
  }
});

for (const address of [
  "0.0.0.1",
  "10.0.0.1",
  "100.64.0.1",
  "127.0.0.1",
  "169.254.1.1",
  "172.16.0.1",
  "192.0.0.1",
  "192.0.2.1",
  "192.168.1.1",
  "198.18.0.1",
  "198.51.100.1",
  "203.0.113.1",
  "224.0.0.1",
  "240.0.0.1",
]) {
  test(`blocks DNS-resolved unsafe IPv4 ${address}`, async () => {
    const { fetchJobUrl, calls } = handler({
      addresses: [{ address, family: 4 }],
    });
    assert.deepEqual(await fetchJobUrl(JOB_ID), { status: "blocked_url" });
    assert.equal(calls.request, 0);
  });
}

for (const address of [
  "::",
  "::1",
  "::ffff:127.0.0.1",
  "fc00::1",
  "fe80::1",
  "ff00::1",
  "2001:db8::1",
  "2002:0a00:0001::1",
  "3fff::1",
]) {
  test(`blocks DNS-resolved unsafe IPv6 ${address}`, async () => {
    const { fetchJobUrl, calls } = handler({
      addresses: [{ address, family: 6 }],
    });
    assert.deepEqual(await fetchJobUrl(JOB_ID), { status: "blocked_url" });
    assert.equal(calls.request, 0);
  });
}

test("blocks a hostname when any DNS answer is unsafe", async () => {
  const { fetchJobUrl, calls } = handler({
    addresses: [PUBLIC_V4, { address: "127.0.0.1", family: 4 }],
  });
  assert.deepEqual(await fetchJobUrl(JOB_ID), { status: "blocked_url" });
  assert.equal(calls.request, 0);
});

test("does not follow redirects or expose their destination", async () => {
  const marker = "https://private.example/token";
  const { fetchJobUrl, calls } = handler({
    response: {
      status: "response",
      statusCode: 302,
      headers: { location: marker, "content-type": "text/html" },
      body: Buffer.alloc(0),
    },
  });
  const result = await fetchJobUrl(JOB_ID);
  assert.deepEqual(result, { status: "redirect" });
  assert.equal(JSON.stringify(result).includes(marker), false);
  assert.equal(calls.request, 1);
});

test("maps bounded network outcomes to sanitized typed results", async () => {
  for (const [networkStatus, expectedStatus] of [
    ["timeout", "timeout"],
    ["oversized_body", "oversized_body"],
    ["network_failure", "http_failure"],
  ] as const) {
    const { fetchJobUrl } = handler({
      response: { status: networkStatus },
    });
    assert.deepEqual(await fetchJobUrl(JOB_ID), {
      status: expectedStatus,
    });
  }
});

test("rejects unsupported content, HTTP failures, empty text, and oversized extracted text", async () => {
  const cases = [
    {
      response: {
        status: "response" as const,
        statusCode: 200,
        headers: { "content-type": "application/pdf" },
        body: Buffer.from("private"),
      },
      expected: "unsupported_content",
    },
    {
      response: {
        status: "response" as const,
        statusCode: 200,
        headers: {
          "content-type": "text/html",
          "content-encoding": "gzip",
        },
        body: Buffer.from("compressed bytes are not interpreted"),
      },
      expected: "unsupported_content",
    },
    {
      response: {
        status: "response" as const,
        statusCode: 503,
        headers: { "content-type": "text/plain" },
        body: Buffer.from("private"),
      },
      expected: "http_failure",
    },
    {
      response: {
        status: "response" as const,
        statusCode: 200,
        headers: { "content-type": "text/html" },
        body: Buffer.from("<script>only hidden text</script>"),
      },
      expected: "empty_text",
    },
    {
      response: {
        status: "response" as const,
        statusCode: 200,
        headers: { "content-type": "text/plain" },
        body: Buffer.from("x".repeat(JOB_URL_FETCH_MAX_TEXT_CHARACTERS + 1)),
      },
      expected: "oversized_body",
    },
  ];

  for (const { response, expected } of cases) {
    const { fetchJobUrl } = handler({ response });
    assert.deepEqual(await fetchJobUrl(JOB_ID), { status: expected });
  }
});

test("transport source is server-only, owner-scoped, one-request, redirect-safe, and bounded", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../../lib/jobs/job-url-fetch-transport.ts", import.meta.url),
      "utf8",
    ),
  );
  assert.match(source, /^import "server-only";/);
  assert.match(source, /\.eq\("id", jobId\)/);
  assert.match(source, /\.eq\("user_id", user\.id\)/);
  assert.match(source, /requestOnce\(url, address\)/);
  assert.doesNotMatch(source, /redirect:\s*["']follow["']/);
  assert.equal(JOB_URL_FETCH_MAX_RESPONSE_BYTES, 1024 * 1024);
  assert.equal(JOB_URL_FETCH_MAX_TEXT_CHARACTERS, 100_000);
  assert.doesNotMatch(
    source,
    /openai|provider|credit|reservation|board_jobs|insert\(|update\(|upsert\(|delete\(/i,
  );
});
