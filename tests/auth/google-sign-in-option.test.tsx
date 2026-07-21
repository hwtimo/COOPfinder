import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { GoogleSignInOption } from "../../components/auth/google-sign-in-option";

test("Google option renders no active control when disabled", () => {
  assert.equal(renderToStaticMarkup(<GoogleSignInOption enabled={false} />), "");
});

test("Google option renders an accessible submit control when enabled", () => {
  const html = renderToStaticMarkup(<GoogleSignInOption enabled />);
  assert.match(html, /<button[^>]*type="submit"/);
  assert.match(html, />Continue with Google<\/button>/);
});
