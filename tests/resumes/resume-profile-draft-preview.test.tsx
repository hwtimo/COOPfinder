import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ResumeProfileDraftPreview } from "../../components/resumes/resume-profile-draft-preview";
import {
  RESUME_PROFILE_DRAFT_CONTRACT_VERSION,
  type ResumeProfileDraftV1,
} from "../../lib/resumes/resume-profile-draft-contract";

const draft: ResumeProfileDraftV1 = {
  contractVersion: RESUME_PROFILE_DRAFT_CONTRACT_VERSION,
  skills: ["TypeScript"],
  education: [
    {
      temporaryId: "resume-draft-education-1",
      section: "education",
      source: "Resume upload draft",
      text: "BSc Computing Science",
      skills: [],
      confirmed: false,
      sortOrder: 0,
    },
  ],
  workExperience: [],
  projects: [],
  leadershipActivities: [],
};

test("temporary preview labels every AI result as requiring review", () => {
  const html = renderToStaticMarkup(
    <ResumeProfileDraftPreview draft={draft} />,
  );
  assert.match(html, /Master Profile draft — review required/);
  assert.match(html, /has not been saved/);
  assert.match(html, /Every item is unconfirmed/);
  assert.match(html, /Unconfirmed draft/);
  assert.match(html, /TypeScript/);
  assert.match(html, /BSc Computing Science/);
  assert.doesNotMatch(html, /Save|Confirm|Approved/);
});

test("empty supported categories remain honest and do not fabricate content", () => {
  const emptyDraft: ResumeProfileDraftV1 = {
    ...draft,
    skills: [],
    education: [],
  };
  const html = renderToStaticMarkup(
    <ResumeProfileDraftPreview draft={emptyDraft} />,
  );
  assert.equal(
    (html.match(/No draft items found\./g) ?? []).length,
    5,
  );
  assert.doesNotMatch(html, /employer|achievement|metric/i);
});
