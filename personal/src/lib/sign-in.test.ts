import assert from "node:assert/strict";
import test from "node:test";
import { appName } from "./env.ts";
import { sessionDisplayName, signInDisplayName } from "./sign-in.ts";

test("the display name is trimmed and any name is accepted", () => {
  assert.equal(signInDisplayName("  Jess  "), "Jess");
  assert.equal(signInDisplayName("PA"), "PA");
  assert.equal(signInDisplayName("x"), "x");
  assert.equal(signInDisplayName("A".repeat(120))?.length, 80);
});

test("a blank name does not sign in", () => {
  assert.equal(signInDisplayName("   "), null);
  assert.equal(signInDisplayName(""), null);
  assert.equal(signInDisplayName(undefined), null);
});

test("APP_NAME stays the fallback when the session has no name", () => {
  const previous = process.env.APP_NAME;
  process.env.APP_NAME = "Desk name";
  try {
    assert.equal(sessionDisplayName("  ", appName()), "Desk name");
    assert.equal(sessionDisplayName(undefined, appName()), "Desk name");
    assert.equal(sessionDisplayName("  Millie  ", appName()), "Millie");
  } finally {
    if (previous === undefined) delete process.env.APP_NAME;
    else process.env.APP_NAME = previous;
  }
});
