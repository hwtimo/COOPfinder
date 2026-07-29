import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildTailoringProviderInputV2 } from "../../lib/tailoring/build-tailoring-provider-input-v2";
import {
  createOwnedUserEditedTailoredResumeVersionCoordinator,
  type CreateOwnedUserEditedTailoredResumeVersionDependencies,
} from "../../lib/tailoring/create-owned-user-edited-tailored-resume-version";
import { buildTailoredResumeDocument } from "../../lib/tailoring/tailored-resume-document";
import { buildTailoredResumeVersionContent } from "../../lib/tailoring/tailored-resume-version-content";
import {
  buildUserEditedTailoredResumeVersion,
  USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
  userEditedTailoredResumeVersionContentV1Schema,
} from "../../lib/tailoring/user-edited-tailored-resume-version";
import {
  readyPreflightV2,
  resumeSourceSnapshotV2,
  validTailoringPlanV2,
} from "./tailoring-v2-fixtures";

const USER_ID = "a71a0000-0000-4000-8000-000000000001";
const FOREIGN_USER_ID = "a71a0000-0000-4000-8000-000000000002";
const PARENT_ID = "b71a0000-0000-4000-8000-000000000001";
const CHILD_ID = "b71a0000-0000-4000-8000-000000000002";
const JOB_ID = "c71a0000-0000-4000-8000-000000000001";

function generatedContent() {
  const input = buildTailoringProviderInputV2(
    readyPreflightV2(),
    resumeSourceSnapshotV2(),
  );
  assert.equal(input.status, "success");
  if (input.status !== "success") throw new Error("expected provider input");
  const plan = validTailoringPlanV2();
  const document = buildTailoredResumeDocument(input.input, plan);
  assert.equal(document.status, "success");
  if (document.status !== "success") throw new Error("expected document");
  const content = buildTailoredResumeVersionContent(
    input.input,
    plan,
    document.document,
    document.document.sourceFingerprint,
  );
  assert.equal(content.status, "success");
  if (content.status !== "success") throw new Error("expected version content");
  return content.content;
}

function validEdit() {
  return {
    contractVersion: USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
    entries: [
      {
        entryId: "entry_001",
        bullets: [
          {
            fragmentId: "fragment_001_001",
            text: "  Improved latency by 41% after measuring the bottleneck.  ",
          },
          {
            fragmentId: "fragment_001_002",
            text: "Built keyboard-accessible navigation.",
          },
        ],
      },
    ],
  } as const;
}

test("builds a user-authored child while preserving the generated parent", () => {
  const parent = generatedContent();
  const before = structuredClone(parent);
  const result = buildUserEditedTailoredResumeVersion(
    PARENT_ID,
    parent,
    validEdit(),
  );

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.deepEqual(parent, before);
  assert.equal(result.content.authorship, "user");
  assert.equal(result.content.parentVersionId, PARENT_ID);
  const bullets = result.content.document.sections.flatMap((section) =>
    section.entries.flatMap((entry) =>
      entry.bullets.map((bullet) => bullet.text),
    ),
  );
  assert.deepEqual(bullets, [
    "Improved latency by 41% after measuring the bottleneck.",
    "Built keyboard-accessible navigation.",
  ]);
  assert.equal(
    userEditedTailoredResumeVersionContentV1Schema.safeParse(result.content)
      .success,
    true,
  );
});

test("persists bullet removal and ordering without inventing provenance", () => {
  const parent = generatedContent();
  const result = buildUserEditedTailoredResumeVersion(PARENT_ID, parent, {
    contractVersion: USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
    entries: [
      {
        entryId: "entry_001",
        bullets: [
          {
            fragmentId: "fragment_001_001",
            text: "Reworded by the user.",
          },
        ],
      },
    ],
  });
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  const bullets = result.content.document.sections.flatMap((section) =>
    section.entries.flatMap((entry) => entry.bullets),
  );
  assert.deepEqual(bullets, [
    {
      text: "Reworded by the user.",
      provenance: {
        entryId: "entry_001",
        fragmentId: "fragment_001_001",
      },
    },
  ]);
});

test("rejects empty, malformed, duplicate, foreign, and invented bullet inputs", () => {
  const parent = generatedContent();
  for (const input of [
    {
      contractVersion: USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
      entries: [],
    },
    {
      contractVersion: USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
      entries: [
        {
          entryId: "entry_001",
          bullets: [{ fragmentId: "fragment_001_001", text: "   " }],
        },
      ],
    },
    {
      contractVersion: USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
      entries: [
        {
          entryId: "entry_001",
          bullets: [
            { fragmentId: "fragment_001_001", text: "One" },
            { fragmentId: "fragment_001_001", text: "Two" },
          ],
        },
      ],
    },
    {
      contractVersion: USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
      entries: [
        {
          entryId: "entry_999",
          bullets: [{ fragmentId: "fragment_001_001", text: "Unknown" }],
        },
      ],
    },
    {
      contractVersion: USER_EDITED_TAILORED_RESUME_INPUT_CONTRACT_VERSION,
      entries: [
        {
          entryId: "entry_001",
          bullets: [{ fragmentId: "fragment_999", text: "Invented" }],
        },
      ],
    },
  ]) {
    assert.deepEqual(
      buildUserEditedTailoredResumeVersion(PARENT_ID, parent, input),
      { status: "invalid_document" },
    );
  }
  assert.deepEqual(
    buildUserEditedTailoredResumeVersion(PARENT_ID, {}, validEdit()),
    { status: "invalid_parent" },
  );
});

type HarnessOptions = Readonly<{
  user?: Readonly<{ id: string }> | null;
  parentUserId?: string;
  parentAuthorship?: string;
  parentVersionId?: string | null;
  persistUnavailable?: boolean;
}>;

function coordinatorHarness(options: HarnessOptions = {}) {
  const calls: string[] = [];
  const inserts: unknown[] = [];
  const parent = {
    id: PARENT_ID,
    name: "Product Developer - tailored v2",
    jobPostingId: JOB_ID,
    content: generatedContent(),
    authorship: options.parentAuthorship ?? "ai_generated",
    parentVersionId: options.parentVersionId ?? null,
  };
  const dependencies: CreateOwnedUserEditedTailoredResumeVersionDependencies = {
    async getAuthenticatedUser() {
      calls.push("auth");
      return options.user === undefined ? { id: USER_ID } : options.user;
    },
    async getOwnedParentVersion({ parentVersionId, userId }) {
      calls.push(`parent:${parentVersionId}:${userId}`);
      return userId === (options.parentUserId ?? USER_ID) ? parent : null;
    },
    async insertChildVersion(input) {
      calls.push("insert");
      inserts.push(structuredClone(input));
      return options.persistUnavailable
        ? { status: "unavailable" }
        : {
            status: "created",
            id: CHILD_ID,
            name: input.name,
          };
    },
  };
  return {
    coordinator:
      createOwnedUserEditedTailoredResumeVersionCoordinator(dependencies),
    calls,
    inserts,
    parent,
  };
}

test("owner creates one linked user-authored child without changing the parent", async () => {
  const fixture = coordinatorHarness();
  const before = structuredClone(fixture.parent);
  const result = await fixture.coordinator(PARENT_ID, validEdit());

  assert.deepEqual(result, {
    status: "created",
    resumeVersionId: CHILD_ID,
    versionName: "Product Developer - tailored v2 - edited",
  });
  assert.deepEqual(fixture.parent, before);
  assert.equal(fixture.inserts.length, 1);
  assert.deepEqual(
    fixture.inserts.map((value) => {
      const insert = value as {
        userId: string;
        jobPostingId: string;
        parentVersionId: string;
        content: { authorship: string; parentVersionId: string };
      };
      return {
        userId: insert.userId,
        jobPostingId: insert.jobPostingId,
        parentVersionId: insert.parentVersionId,
        contentAuthorship: insert.content.authorship,
        contentParentVersionId: insert.content.parentVersionId,
      };
    }),
    [
      {
        userId: USER_ID,
        jobPostingId: JOB_ID,
        parentVersionId: PARENT_ID,
        contentAuthorship: "user",
        contentParentVersionId: PARENT_ID,
      },
    ],
  );
});

test("foreign and missing parents are indistinguishable and never persist", async () => {
  const fixture = coordinatorHarness({
    user: { id: FOREIGN_USER_ID },
    parentUserId: USER_ID,
  });
  assert.deepEqual(await fixture.coordinator(PARENT_ID, validEdit()), {
    status: "not_found",
  });
  assert.deepEqual(fixture.inserts, []);
});

test("edited children cannot be used as generated parents", async () => {
  const fixture = coordinatorHarness({
    parentAuthorship: "user_authored",
    parentVersionId: CHILD_ID,
  });
  assert.deepEqual(await fixture.coordinator(PARENT_ID, validEdit()), {
    status: "invalid_parent",
  });
  assert.deepEqual(fixture.inserts, []);
});

test("failed persistence returns unavailable with no partial or repeated write", async () => {
  const fixture = coordinatorHarness({ persistUnavailable: true });
  const before = structuredClone(fixture.parent);
  assert.deepEqual(await fixture.coordinator(PARENT_ID, validEdit()), {
    status: "unavailable",
  });
  assert.equal(fixture.inserts.length, 1);
  assert.deepEqual(fixture.parent, before);
});

test("production coordinator is owner-scoped and has no AI or credit path", () => {
  const source = readFileSync(
    "lib/tailoring/create-owned-user-edited-tailored-resume-version.ts",
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.match(source, /getSupabaseUser/);
  assert.match(source, /createSupabaseServerClient/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(source, /createSupabaseAdminClient/);
  assert.match(source, /\.insert\(/);
  assert.doesNotMatch(
    source,
    /openai|provider|credit|reservation|ledger|fetch\(|console\./i,
  );
  assert.doesNotMatch(source, /\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
});
