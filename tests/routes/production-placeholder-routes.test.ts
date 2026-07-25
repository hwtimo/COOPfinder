import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const calendar = readFileSync("app/(app)/calendar/page.tsx", "utf8");
const insights = readFileSync("app/(app)/insights/page.tsx", "utf8");
const documents = readFileSync("app/(app)/documents/page.tsx", "utf8");
const productionSources = [calendar, insights, documents].join("\n");

test("Calendar is an honest placeholder with one Applications action", () => {
  assert.match(calendar, /title="Calendar is not available yet"/);
  assert.match(calendar, /actionLabel="Open Applications"/);
  assert.match(calendar, /onActionHref="\/applications"/);
  assert.equal([...calendar.matchAll(/actionLabel=/g)].length, 1);
  assert.doesNotMatch(calendar, /will show up here automatically/i);
});

test("Insights is an honest placeholder with one My Jobs action", () => {
  assert.match(insights, /title="Insights are not available yet"/);
  assert.match(insights, /actionLabel="Open My Jobs"/);
  assert.match(insights, /onActionHref="\/jobs"/);
  assert.equal([...insights.matchAll(/actionLabel=/g)].length, 1);
  assert.doesNotMatch(
    insights,
    /response rates|resume performance|unlock|activity to analyze/i,
  );
});

test("Documents is an honest placeholder with one Resumes action", () => {
  assert.match(documents, /title="Documents are not available yet"/);
  assert.match(documents, /actionLabel="Open Resumes"/);
  assert.match(documents, /onActionHref="\/resumes"/);
  assert.equal([...documents.matchAll(/actionLabel=/g)].length, 1);
  assert.doesNotMatch(documents, /will be stored here|exported resume PDFs/i);
});

test("production placeholder routes contain no mock data or fixture copy", () => {
  assert.doesNotMatch(productionSources, /lib\/mock/);
  assert.doesNotMatch(productionSources, /mock[A-Z]|Maya Chen|currentUser/i);
  assert.doesNotMatch(
    productionSources,
    /\b(?:42|87|93)%\b|estimated callback|recent activity/i,
  );
});
