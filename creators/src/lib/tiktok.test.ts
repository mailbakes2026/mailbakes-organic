import assert from "node:assert/strict";
import test from "node:test";
import { normaliseHandle, tiktokProfileUrl } from "./tiktok.ts";

test("a stored @handle opens that TikTok profile", () => {
  assert.equal(tiktokProfileUrl("@lslife9"), "https://www.tiktok.com/@lslife9");
  assert.equal(tiktokProfileUrl("  @devon.mum "), "https://www.tiktok.com/@devon.mum");
  assert.equal(normaliseHandle("placeswefounduk").value, "@placeswefounduk");
});

test("a pasted profile URL becomes the @handle", () => {
  const url = "https://www.tiktok.com/@crusetwins?lang=en";
  assert.equal(normaliseHandle(url).value, "@crusetwins");
  assert.equal(tiktokProfileUrl("https://tiktok.com/@gillespie.miria/"), "https://www.tiktok.com/@gillespie.miria");
  assert.equal(normaliseHandle("https://m.tiktok.com/@evahegz18/video/123").value, "@evahegz18");
});

test("Samantha Starr is not turned into a handle", () => {
  assert.equal(normaliseHandle("Samantha Starr").value, "Samantha Starr");
  assert.equal(tiktokProfileUrl("Samantha Starr"), null);
  assert.equal(tiktokProfileUrl(""), null);
  assert.equal(tiktokProfileUrl("   "), null);
});

test("a link that is not a TikTok profile is refused", () => {
  assert.equal(normaliseHandle("https://vm.tiktok.com/ZKab").ok, false);
  assert.equal(normaliseHandle("https://example.com/@lslife9").ok, false);
  assert.equal(tiktokProfileUrl("javascript:alert(1)"), null);
  assert.equal(normaliseHandle("@").value, "@");
});
