import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (path === join("lib", "mock")) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(path) ? [path] : [];
  });
}

const productionFiles = [
  ...sourceFiles("app"),
  ...sourceFiles("components"),
  ...sourceFiles("lib"),
];

test("production source cannot import the mock fixture library", () => {
  const offenders = productionFiles
    .filter((file) =>
      /\b(?:from|import)\s*(?:\([^)]*\)|[^;\n]*)["'][^"']*lib\/mock(?:\/[^"']*)?["']/.test(
        readFileSync(file, "utf8"),
      ),
    )
    .map((file) => relative(".", file));

  assert.deepEqual(offenders, []);
});

test("production source contains no mock-build or named fixture copy", () => {
  const fixturePattern =
    /Maya Chen|maya\.chen|Northstar Robotics|Clio|FortisBC|Hootsuite|mock build|starter set|starter roles|mockJobs|mockApplications|mockResume|mockTailoring|currentUser/i;
  const offenders = productionFiles
    .filter((file) => fixturePattern.test(readFileSync(file, "utf8")))
    .map((file) => relative(".", file));

  assert.deepEqual(offenders, []);
});

test("legacy tailoring fixture routes are removed and non-UUID IDs fail closed", () => {
  const route = readFileSync(
    "app/(app)/resumes/tailor/[jobId]/page.tsx",
    "utf8",
  );

  assert.match(route, /if \(!isUuid\(jobId\)\) notFound\(\)/);
  assert.match(route, /getOwnedTailoringPreflight\(jobId\)/);
  assert.match(route, /getCurrentTailoringCreditBalance\(\)/);
  assert.doesNotMatch(
    route,
    /mockJobs|mockTailoringSessions|TailoringWorkspace|generateStaticParams/,
  );
});

test("public board fails honestly when unavailable and never loads fixture jobs", () => {
  const query = readFileSync("lib/board/queries.ts", "utf8");
  const board = readFileSync("app/(app)/board/page.tsx", "utf8");
  const detail = readFileSync("app/(app)/board/[id]/page.tsx", "utf8");

  assert.equal(
    [...query.matchAll(/if \(!supabase\) \{\s*return \{ status: "error"/g)]
      .length,
    2,
  );
  assert.doesNotMatch(query, /publicStarterJobs|publicFixtureJobs|fixture/);
  assert.doesNotMatch(`${board}\n${detail}`, /starter set|source === "fixture"/);
});

test("Start ranks only real board rows supplied by its server page", () => {
  const page = readFileSync("app/start/page.tsx", "utf8");
  const onboarding = readFileSync(
    "components/start/start-onboarding.tsx",
    "utf8",
  );

  assert.match(page, /getPublicBoardJobs\(\)/);
  assert.match(
    page,
    /boardJobs=\{boardResult\.status === "ready" \? boardResult\.data : \[\]\}/,
  );
  assert.match(onboarding, /rankStarterJobs\(draft, boardJobs\)/);
  assert.match(onboarding, /No fallback roles are shown\./);
  assert.doesNotMatch(onboarding, /publicStarterJobs|starter set|starter roles/);
});
