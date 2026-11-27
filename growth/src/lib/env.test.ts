import assert from "node:assert/strict";
import test from "node:test";
import { klaviyoMissing, klaviyoPrivateKey } from "./env.ts";

test("Klaviyo reads KLAVIYO_PRIVATE_API_KEY, then KLAVIYO_PRIVATE_KEY", () => {
  const previousApi = process.env.KLAVIYO_PRIVATE_API_KEY;
  const previous = process.env.KLAVIYO_PRIVATE_KEY;
  delete process.env.KLAVIYO_PRIVATE_API_KEY;
  delete process.env.KLAVIYO_PRIVATE_KEY;
  try {
    assert.equal(klaviyoPrivateKey(), "");
    assert.deepEqual(klaviyoMissing(), ["KLAVIYO_PRIVATE_API_KEY"]);
    process.env.KLAVIYO_PRIVATE_KEY = "  pk_fallback  ";
    assert.equal(klaviyoPrivateKey(), "pk_fallback");
    assert.deepEqual(klaviyoMissing(), []);
    process.env.KLAVIYO_PRIVATE_API_KEY = "pk_primary";
    assert.equal(klaviyoPrivateKey(), "pk_primary");
    assert.deepEqual(klaviyoMissing(), []);
  } finally {
    if (previousApi === undefined) delete process.env.KLAVIYO_PRIVATE_API_KEY;
    else process.env.KLAVIYO_PRIVATE_API_KEY = previousApi;
    if (previous === undefined) delete process.env.KLAVIYO_PRIVATE_KEY;
    else process.env.KLAVIYO_PRIVATE_KEY = previous;
  }
});