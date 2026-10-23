import assert from "node:assert/strict";
import test from "node:test";
import { parseInquiry, parsePatch } from "./parse.ts";

test("an inquiry keeps only the fields automation is allowed to send", () => {
  const parsed = parseInquiry({
    name: "  Patricia Fale ",
    handle: "@patricia.fale.ugc",
    email: "patricia.soraia@hotmail.com",
    shopifyOrder: "",
    cardMessage: "Hello",
    notes: "Approve TikTok sample then paste note",
    rush: false,
    stage: "shipped",
    trackingNumber: "AB123456789GB",
    rating: 5,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value, {
    name: "Patricia Fale",
    handle: "@patricia.fale.ugc",
    email: "patricia.soraia@hotmail.com",
    shopifyOrder: "",
    cardMessage: "Hello",
    notes: "Approve TikTok sample then paste note",
    rush: false,
  });
});

test("a name is required and a bad email is refused", () => {
  assert.equal(parseInquiry({ handle: "@x" }).ok, false);
  const email = parseInquiry({ name: "Louis", email: "not-an-email" });
  assert.equal(email.ok, false);
  if (!email.ok) assert.match(email.error, /email/i);
});

test("rush must be a boolean and defaults to false", () => {
  const parsed = parseInquiry({ name: "Louis" });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.rush, false);
  assert.equal(parseInquiry({ name: "Louis", rush: "yes" }).ok, false);
});

test("a TikTok profile URL is stored as the @handle", () => {
  const parsed = parseInquiry({ name: "Katharine Cruse", handle: "https://www.tiktok.com/@crusetwins/" });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.handle, "@crusetwins");
  const kept = parsePatch({ handle: "Samantha Starr" });
  assert.equal(kept.ok, true);
  if (kept.ok) assert.equal(kept.value.handle, "Samantha Starr");
  const spaced = parsePatch({ handle: "  @lslife9  " });
  assert.equal(spaced.ok, true);
  if (spaced.ok) assert.equal(spaced.value.handle, "@lslife9");
  assert.equal(parsePatch({ handle: "https://example.com/@lslife9" }).ok, false);
});

test("a patch refuses a made-up stage and a tracking link", () => {
  assert.equal(parsePatch({ stage: "celebration" }).ok, false);
  const tracking = parsePatch({ trackingNumber: "https://example.com" });
  assert.equal(tracking.ok, false);
  const rating = parsePatch({ rating: 6 });
  assert.equal(rating.ok, false);
  const ok = parsePatch({ rating: null, views: 1200, shipDate: "2026-10-26" });
  assert.equal(ok.ok, true);
});
