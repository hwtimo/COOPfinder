import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const privacy = readFileSync("app/privacy/page.tsx", "utf8");
const terms = readFileSync("app/terms/page.tsx", "utf8");
const login = readFileSync("app/login/page.tsx", "utf8");
const start = readFileSync("components/start/start-onboarding.tsx", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const extractionProvider = readFileSync(
  "lib/ai/openai-job-extraction-provider.ts",
  "utf8",
);
const tailoringProvider = readFileSync(
  "lib/tailoring/openai-tailoring-generation-provider.ts",
  "utf8",
);
const tailoringInput = readFileSync(
  "lib/tailoring/build-tailoring-provider-input-v2.ts",
  "utf8",
);

test("privacy and terms are public routes with page metadata", () => {
  assert.match(privacy, /title: "Privacy Policy \| InternshipBC"/);
  assert.match(terms, /title: "Terms of Use \| InternshipBC"/);
  assert.doesNotMatch(proxy, /"\/privacy\/:path\*"/);
  assert.doesNotMatch(proxy, /"\/terms\/:path\*"/);
  assert.doesNotMatch(privacy, /getSupabaseUser|redirect\(|getLoginHref/);
  assert.doesNotMatch(terms, /getSupabaseUser|redirect\(|getLoginHref/);
});

test("privacy copy matches the implemented storage and AI boundaries", () => {
  assert.match(privacy, /raw job-description text stays private to your account/i);
  assert.match(privacy, /not published to the\s+public job board/i);
  assert.match(privacy, /sends the private job-description text to OpenAI/i);
  assert.match(
    privacy,
    /name,\s*email,\s*education,\s*skills,\s*structured candidate evidence/i,
  );
  assert.match(privacy, /confirmed manual resume fragments/i);
  assert.match(privacy, /API data is not used to train or improve its models unless/i);
  assert.match(privacy, /store: false/);
  assert.match(privacy, /up to 30 days by default/i);
  assert.match(privacy, /Self-serve account deletion is not currently available/i);

  assert.match(extractionProvider, /input: jobDescription/);
  assert.match(extractionProvider, /store: false/);
  assert.match(tailoringProvider, /input: JSON\.stringify\(input\)/);
  assert.match(tailoringProvider, /store: false/);
  assert.match(tailoringInput, /identity: structuredClone\(snapshot\.identity\)/);
  assert.match(tailoringInput, /education: structuredClone\(snapshot\.education\)/);
  assert.match(tailoringInput, /entries,/);
  assert.match(tailoringInput, /evidence,/);
});

test("terms preserve user review and no-guarantee boundaries", () => {
  assert.match(terms, /does not apply to jobs automatically/i);
  assert.match(
    terms,
    /submit your application on the\s+employer&apos;s website/i,
  );
  assert.match(terms, /responsible for the accuracy, completeness, and legality/i);
  assert.match(terms, /Review all extracted requirements, matches, generated resume/i);
  assert.match(terms, /does not guarantee an interview, offer, employment outcome/i);
  assert.doesNotMatch(terms, /guaranteed match|guaranteed employment|we apply for you/i);
});

test("public and authentication surfaces link to both legal pages", () => {
  assert.match(login, /<PublicLegalLinks className="mt-5" \/>/);
  assert.match(start, /<PublicLegalLinks \/>/);
});
