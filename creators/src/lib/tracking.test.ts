import assert from "node:assert/strict";
import test from "node:test";
import { royalMailTrackUrl, safeHttpUrl } from "./tracking.ts";

test("Royal Mail link uses the tracking number", () => {
  assert.equal(
    royalMailTrackUrl("AB 1234 5678 9GB", ""),
    "https://www.royalmail.com/track-your-item#/tracking-results/AB123456789GB",
  );
  assert.equal(
    royalMailTrackUrl("AB123456789GB", "Royal Mail"),
    "https://www.royalmail.com/track-your-item#/tracking-results/AB123456789GB",
  );
});

test("another courier is not sent to Royal Mail", () => {
  assert.equal(royalMailTrackUrl("123", "DPD"), null);
  assert.equal(royalMailTrackUrl("   ", "Royal Mail"), null);
});

test("post links stay on http or https", () => {
  assert.equal(safeHttpUrl("https://www.tiktok.com/@crusetwins/video/1"), "https://www.tiktok.com/@crusetwins/video/1");
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl(""), null);
});
