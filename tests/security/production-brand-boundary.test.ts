import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(path) ? [path] : [];
  });
}

const userFacingProductionFiles = [
  ...sourceFiles("app"),
  ...sourceFiles("components"),
];

test("production user-facing code contains no legacy brand strings", () => {
  const legacyBrand = /\bcoop[\s-]?finder\b/i;
  const offenders = userFacingProductionFiles
    .filter((file) => {
      const source = readFileSync(file, "utf8").replace(
        /["']coopfinder\.[^"']+["']/gi,
        "",
      );
      return legacyBrand.test(source);
    })
    .map((file) => relative(".", file));

  assert.deepEqual(offenders, []);
});
