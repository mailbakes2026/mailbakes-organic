import assert from "node:assert/strict";
import test from "node:test";
import { scrub } from "./scrub.ts";

test("scrub removes bearer tokens, meta tokens, and client secrets", () => {
  const dirty = "failed Bearer abc.def token access_token=EAABxxxxxxxxxxxxxxxxxxxxxx&client_secret=shpss_secretvalue pk_live_123";
  const clean = scrub(dirty);
  assert.equal(clean.includes("abc.def"), false);
  assert.equal(clean.includes("EAABxxxx"), false);
  assert.equal(clean.includes("shpss_secretvalue"), false);
  assert.equal(clean.includes("pk_live_123"), false);
  assert.match(clean, /Bearer redacted/);
});
