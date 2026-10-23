import assert from "node:assert/strict";
import test from "node:test";
import { safeEqual } from "./secret.ts";

test("matching secrets compare equal", () => {
  assert.equal(safeEqual("a-long-token-value", "a-long-token-value"), true);
});

test("different lengths do not match", () => {
  assert.equal(safeEqual("short", "a-much-longer-token"), false);
});
