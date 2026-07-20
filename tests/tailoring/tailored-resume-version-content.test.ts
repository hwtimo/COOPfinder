import assert from "node:assert/strict";
import test from "node:test";

import { buildTailoringProviderInputV2 } from "../../lib/tailoring/build-tailoring-provider-input-v2";
import { buildTailoredResumeDocument } from "../../lib/tailoring/tailored-resume-document";
import {
  buildTailoredResumeDocumentReviewViewModel,
  buildTailoredResumeVersionContent,
  parseTailoredResumeVersionContent,
} from "../../lib/tailoring/tailored-resume-version-content";
import { readyPreflightV2, resumeSourceSnapshotV2, validTailoringPlanV2 } from "./tailoring-v2-fixtures";

function fixture() {
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
  return content.content;
}

test("builds a strict v2 envelope containing only selected immutable sources", () => {
  const content = fixture();
  assert.equal(content.contractVersion, "tailored-resume-version-content-v2");
  assert.equal(content.selectedSources.fragments.length, 2);
  assert.equal(content.selectedSources.evidence.length, 4);
  const serialized = JSON.stringify(content);
  assert.match(serialized, /Improved latency by 37% in 2025\./);
  assert.doesNotMatch(serialized, /This approved but unselected fragment/);
  assert.doesNotMatch(serialized, /Build reliable interfaces|Kubernetes/);
  assert.doesNotMatch(serialized, /prompt|instruction|diagnostic|reservation|credit/i);
});

test("rejects mismatched lineage and source snapshots", () => {
  const content = fixture();
  assert.equal(parseTailoredResumeVersionContent({ ...content, sourceFingerprint: "b".repeat(64) }).status, "invalid");
  assert.equal(parseTailoredResumeVersionContent({ ...content, selectedSources: { ...content.selectedSources, fragments: [] } }).status, "invalid");
  assert.equal(parseTailoredResumeVersionContent({ ...content, unexpected: true }).status, "invalid");
});

test("review model is derived only from the stored document", () => {
  const content = fixture();
  const review = buildTailoredResumeDocumentReviewViewModel(content);
  assert.equal(review.identity.fullName, "Avery Chen");
  assert.deepEqual(review.sections.flatMap((section) => section.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text))), [
    "Built keyboard-accessible navigation.",
    "Improved latency by 37% in 2025.",
  ]);
  assert.doesNotMatch(JSON.stringify(review), /job|company|requirement|unselected/i);
});
