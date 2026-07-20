import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TailoredResumeReview } from "../../components/app/tailored-resume-review";
import { buildTailoringProviderInputV2 } from "../../lib/tailoring/build-tailoring-provider-input-v2";
import { buildTailoredResumeDocument } from "../../lib/tailoring/tailored-resume-document";
import { buildTailoredResumeVersionContent, buildTailoredResumeDocumentReviewViewModel } from "../../lib/tailoring/tailored-resume-version-content";
import type { GetOwnedTailoredResumeVersionResult } from "../../lib/tailoring/get-owned-tailored-resume-version";
import { readyPreflightV2, resumeSourceSnapshotV2, validTailoringPlanV2 } from "./tailoring-v2-fixtures";

const VERSION_ID = "e71a0000-0000-4000-8000-000000000001";

function readyVersion() {
  const input = buildTailoringProviderInputV2(readyPreflightV2(), resumeSourceSnapshotV2());
  assert.equal(input.status, "success");
  if (input.status !== "success") throw new Error("expected input");
  const plan = validTailoringPlanV2();
  const document = buildTailoredResumeDocument(input.input, plan);
  assert.equal(document.status, "success");
  if (document.status !== "success") throw new Error("expected document");
  const content = buildTailoredResumeVersionContent(input.input, plan, document.document, document.document.sourceFingerprint);
  assert.equal(content.status, "success");
  if (content.status !== "success") throw new Error("expected content");
  return {
    status: "ready" as const,
    resumeVersionId: VERSION_ID,
    versionName: "Product Developer - tailored v1",
    review: buildTailoredResumeDocumentReviewViewModel(content.content),
  };
}

test("owner review renders persisted identity, education, sections, exact bullets, and evidence", () => {
  const html = renderToStaticMarkup(<TailoredResumeReview version={readyVersion()} />);
  assert.match(html, /Avery Chen/);
  assert.match(html, /avery@example\.invalid/);
  assert.match(html, /SFU/);
  assert.match(html, /Computing Science/);
  assert.match(html, /Frontend Developer/);
  assert.match(html, /Improved latency by 37% in 2025\./);
  assert.match(html, /Built keyboard-accessible navigation\./);
  assert.match(html, /TypeScript/);
  assert.match(html, /React/);
  assert.match(html, /AWS Certified Cloud Practitioner/);
  assert.match(html, /French/);
  assert.doesNotMatch(html, /overall score|match score|qualified|unqualified|verdict/i);
  assert.doesNotMatch(html, /This approved but unselected fragment/);
});

test("older generated-content v1 renders as a safe evidence record", () => {
  const version: Extract<GetOwnedTailoredResumeVersionResult, { status: "ready" }> = {
    status: "ready",
    resumeVersionId: VERSION_ID,
    versionName: "Developer - tailored v1",
    review: {
      jobHeading: { title: "Developer", companyName: "Example" },
      summaryEvidence: [{
        term: "TypeScript",
        categoryLabel: "Technology",
        provenanceLabel: "Master Profile technology",
      }],
      sections: [],
    },
  };
  const html = renderToStaticMarkup(<TailoredResumeReview version={version} />);
  assert.match(html, /Older tailoring record/);
  assert.match(html, /verified evidence plan, not a complete printable resume/);
  assert.match(html, /TypeScript/);
  assert.doesNotMatch(html, /overall score|qualified|verdict/i);
});

test("review route uses only the owner-scoped immutable loader and maps safe states", () => {
  const page = readFileSync("app/(app)/resumes/versions/[versionId]/page.tsx", "utf8");
  const loader = readFileSync("lib/tailoring/get-owned-tailored-resume-version.ts", "utf8");
  assert.match(page, /getOwnedTailoredResumeVersion\(versionId\)/);
  assert.match(page, /result\.status === "not_found"\) notFound\(\)/);
  assert.match(page, /legacy_content_unavailable/);
  assert.match(page, /invalid_content/);
  assert.match(loader, /\.eq\("user_id", userId\)/);
  assert.doesNotMatch(`${page}\n${loader}`, /master_profiles|job_postings|raw_text|extracted/);
});

test("print control uses window.print and print styles hide controls and application chrome", () => {
  const button = readFileSync("components/app/resume-version-print-button.tsx", "utf8");
  const page = readFileSync("app/(app)/resumes/versions/[versionId]/page.tsx", "utf8");
  const layout = readFileSync("app/(app)/layout.tsx", "utf8");
  const sidebar = readFileSync("components/app/app-sidebar.tsx", "utf8");
  const topbar = readFileSync("components/app/app-topbar.tsx", "utf8");
  assert.match(button, /window\.print\(\)/);
  assert.match(button, /Print \/ Save as PDF/);
  assert.match(button, /print:hidden/);
  assert.match(page, /@media print/);
  assert.match(page, /@page \{ size: letter/);
  assert.match(layout, /print:pl-0/);
  assert.match(layout, /print:max-w-none print:p-0/);
  assert.match(sidebar, /print:hidden/);
  assert.match(topbar, /print:hidden/);
  assert.doesNotMatch(`${button}\n${page}`, /pdfkit|jspdf|docx|puppeteer|playwright/);
});
