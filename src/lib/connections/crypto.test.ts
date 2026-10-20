import assert from "node:assert/strict";
import test from "node:test";

process.env.TOKEN_ENCRYPTION_KEY = "test-key-that-is-long-enough-for-aes";

const { decryptSecret, encryptSecret } = await import("./crypto.ts");

test("tokens round-trip through encryption", async () => {
  const packed = await encryptSecret("refresh-token-value");
  assert.notEqual(packed, "refresh-token-value");
  assert.equal(await decryptSecret(packed), "refresh-token-value");
});
