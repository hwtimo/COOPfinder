import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "app/(app)/jobs/jobs-page-client.tsx",
  "utf8",
);

test("private jobs keep persisted filters without legacy score thresholds", () => {
  for (const retainedLabel of [
    'label="Role type"',
    'label="Location"',
    'label="Term"',
    'label="Work mode"',
    'label="Co-op eligible"',
    'label="Work authorization"',
    'label="Deadline"',
  ]) {
    assert.match(source, new RegExp(retainedLabel));
  }

  assert.doesNotMatch(source, /label="Match score"/);
  assert.doesNotMatch(source, /(?:80|70|50)%\+/);
  assert.doesNotMatch(
    source,
    /MatchFilter|matchesScoreFilter|filters\.matchScore|matchScore:\s*"all"/,
  );
});
