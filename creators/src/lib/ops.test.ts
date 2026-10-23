import assert from "node:assert/strict";
import test from "node:test";
import { needsTiktokMatch, opsStatusLabel, postTiktokMessage, readTiktokOrderId } from "./ops.ts";

const LONG_ID = "576461234567890123456789";

test("a TikTok order ID stays a string of digits", () => {
  assert.deepEqual(readTiktokOrderId("00123"), { ok: true, value: "00123" });
  assert.deepEqual(readTiktokOrderId(`  ${LONG_ID}  `), { ok: true, value: LONG_ID });
  assert.equal(readTiktokOrderId("").ok && readTiktokOrderId("").value, "");
  assert.equal(readTiktokOrderId(576461234567890).ok, false);
  assert.equal(readTiktokOrderId("12.0").ok, false);
  assert.equal(readTiktokOrderId("12a").ok, false);
});

test("unmatched means a missing order ID or a missing message", () => {
  assert.equal(needsTiktokMatch({ tiktokOrderId: "", tiktokMessage: "Hello" }), true);
  assert.equal(needsTiktokMatch({ tiktokOrderId: "12", tiktokMessage: "  " }), true);
  assert.equal(needsTiktokMatch({ tiktokOrderId: "12", tiktokMessage: "Hello" }), false);
});

test("a saved message is posted as text and a bad token is reported", async () => {
  const previousUrl = process.env.OPS_APP_URL;
  const previousToken = process.env.OPS_API_TOKEN;
  process.env.OPS_APP_URL = "http://orders.test";
  process.env.OPS_API_TOKEN = "ops-test-token";
  try {
    let seen: { url: string; auth: string; body: string; redirect: string } | null = null;
    const ok = await postTiktokMessage(LONG_ID, "Sample card on the way", (async (url, init) => {
      const headers = new Headers(init?.headers);
      seen = {
        url: String(url),
        auth: headers.get("authorization") ?? "",
        body: String(init?.body ?? ""),
        redirect: String(init?.redirect ?? ""),
      };
      return new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch);
    assert.equal(ok.status, "sent");
    assert.equal(seen?.url, "http://orders.test/api/tiktok/message");
    assert.equal(seen?.redirect, "manual");
    assert.equal(seen?.auth, "Bearer ops-test-token");
    const payload = JSON.parse(seen?.body ?? "{}") as { tiktok_order_id: unknown; message: unknown };
    assert.equal(typeof payload.tiktok_order_id, "string");
    assert.equal(payload.tiktok_order_id, LONG_ID);
    assert.equal(payload.message, "Sample card on the way");

    const denied = await postTiktokMessage(LONG_ID, "Hello", (async () => new Response("Bad token", { status: 401 })) as typeof fetch);
    assert.deepEqual(denied, { status: "failed", error: "Bad token" });
    assert.equal(opsStatusLabel("failed", "Bad token"), "Failed: Bad token");
  } finally {
    if (previousUrl === undefined) delete process.env.OPS_APP_URL;
    else process.env.OPS_APP_URL = previousUrl;
    if (previousToken === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previousToken;
  }
});

test("a missing orders env does not call the orders app", async () => {
  const previousUrl = process.env.OPS_APP_URL;
  const previousToken = process.env.OPS_API_TOKEN;
  delete process.env.OPS_APP_URL;
  delete process.env.OPS_API_TOKEN;
  try {
    let called = false;
    const result = await postTiktokMessage("12", "Hello", (async () => {
      called = true;
      return new Response("ok");
    }) as typeof fetch);
    assert.equal(called, false);
    assert.equal(result.status, "not_configured");
    assert.match(opsStatusLabel(result.status, result.error), /Not configured/);
  } finally {
    if (previousUrl === undefined) delete process.env.OPS_APP_URL;
    else process.env.OPS_APP_URL = previousUrl;
    if (previousToken === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previousToken;
  }
});
