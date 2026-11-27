import assert from "node:assert/strict";
import test from "node:test";
import { isTimeout } from "./deadline.ts";

test("timeout and abort errors are recognised", () => {
  const timeout = new Error("The operation was aborted due to timeout");
  timeout.name = "TimeoutError";
  const aborted = new Error("This operation was aborted");
  aborted.name = "AbortError";
  assert.equal(isTimeout(timeout), true);
  assert.equal(isTimeout(aborted), true);
  assert.equal(isTimeout(new Error("Klaviyo request failed (HTTP 401).")), false);
  assert.equal(isTimeout(null), false);
});
