import assert from "node:assert/strict";
import test from "node:test";
import { invalidateRetentionCache, readRetentionMemory, writeRetentionMemory } from "./cache.ts";

test("retention memory cache expires and clears", () => {
  invalidateRetentionCache();
  try {
    assert.equal(readRetentionMemory(1_000, 0), null);
    writeRetentionMemory({ rows: 2 }, 100);
    assert.deepEqual(readRetentionMemory(1_000, 500), { rows: 2 });
    assert.equal(readRetentionMemory(1_000, 1_100), null);
    writeRetentionMemory("fresh", 2_000);
    invalidateRetentionCache();
    assert.equal(readRetentionMemory(1_000, 2_100), null);
    writeRetentionMemory("stale", 3_000, 0);
    assert.equal(readRetentionMemory(1_000, 3_100), null);
  } finally {
    invalidateRetentionCache();
  }
});
