import assert from "node:assert/strict";
import test from "node:test";
import { connectionCopy } from "./connection.ts";
import { KLAVIYO_NOT_CONNECTED } from "./retention/klaviyo-copy.ts";

test("a missing Klaviyo key names the Render step and stays Not connected", () => {
  const copy = connectionCopy({
    name: "Klaviyo",
    missing: ["KLAVIYO_PRIVATE_API_KEY"],
    missingDetail: KLAVIYO_NOT_CONNECTED,
    sync: null,
  });
  assert.equal(copy.state, "not-connected");
  assert.equal(copy.label, "Not connected");
  assert.match(copy.detail, /mailbakes-growth/);
  assert.match(copy.detail, /KLAVIYO_PRIVATE_API_KEY/);
  assert.match(copy.detail, /Environment/);
  assert.equal(copy.detail.includes("pk_"), false);
});

test("Meta still names the missing variables when no custom detail is passed", () => {
  const copy = connectionCopy({
    name: "Meta",
    missing: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
    sync: null,
  });
  assert.equal(copy.label, "Not connected");
  assert.equal(copy.detail, "Meta is not connected. Set META_ACCESS_TOKEN, META_AD_ACCOUNT_ID.");
});

test("a stored sync is Connected", () => {
  const copy = connectionCopy({
    name: "Klaviyo",
    missing: [],
    sync: { status: "ok", detail: "Stored 2 flow rows and 1 campaign rows.", syncedAt: new Date("2026-11-05T10:00:00Z") },
  });
  assert.equal(copy.state, "connected");
  assert.equal(copy.label, "Connected");
  assert.match(copy.detail, /Stored 2 flow rows/);
});
