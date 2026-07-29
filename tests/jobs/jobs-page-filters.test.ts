import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "app/(app)/jobs/jobs-page-client.tsx",
  "utf8",
);

test("private jobs keep persisted filters without legacy score presentation", () => {
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

  assert.doesNotMatch(source, /label="Match score"|Estimated match|matchScore/);
  assert.doesNotMatch(source, /(?:80|70|50)%\+/);
  assert.doesNotMatch(
    source,
    /MatchFilter|matchesScoreFilter|filters\.matchScore|matchScore:\s*"all"/,
  );
});

test("private job loading no longer carries the legacy match score", () => {
  const querySource = readFileSync("lib/jobs/queries.ts", "utf8");
  const typeSource = readFileSync("lib/jobs/types.ts", "utf8");

  assert.doesNotMatch(querySource, /match_score|matchScore/);
  assert.doesNotMatch(typeSource, /matchScore/);
});
