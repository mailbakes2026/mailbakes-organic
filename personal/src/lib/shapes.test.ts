import assert from "node:assert/strict";
import test from "node:test";
import { cleanUrl, parseStatus, ValidationError } from "./shapes.ts";

test("accepts the three run-through statuses", () => {
  assert.equal(parseStatus("needs Millie"), "NEEDS_MILLIE");
  assert.equal(parseStatus("waiting"), "WAITING");
  assert.equal(parseStatus("done"), "DONE");
  assert.equal(parseStatus("later"), null);
});

test("rejects a link that is not http", () => {
  assert.throws(() => cleanUrl("javascript:alert(1)"), ValidationError);
  assert.equal(cleanUrl("https://mail.google.com/mail/u/0/#inbox/abc"), "https://mail.google.com/mail/u/0/#inbox/abc");
  assert.equal(cleanUrl(""), "");
});
