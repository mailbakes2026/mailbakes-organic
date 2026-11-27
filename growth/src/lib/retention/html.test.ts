import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeEmailHtml } from "./html.ts";

test("email html keeps the design and drops scripts", () => {
  const clean = sanitizeEmailHtml(`<html><body><h1 onclick="alert(1)">Hello</h1><a href="javascript:alert(1)">Go</a><script>alert(1)</script><p>Slice</p></body></html>`);
  assert.match(clean, /<h1>Hello<\/h1>/);
  assert.match(clean, /Slice/);
  assert.equal(clean.includes("script"), false);
  assert.equal(clean.includes("onclick"), false);
  assert.equal(clean.includes("javascript:"), false);
});
