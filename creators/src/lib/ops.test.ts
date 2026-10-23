import assert from "node:assert/strict";
import test from "node:test";
import {
  interpretTiktokRead,
  needsTiktokMatch,
  opsStatusLabel,
  postTiktokMessage,
  readTiktokMessage,
  readTiktokOrderId,
  shouldSendTiktokMessage,
  syncSummary,
} from "./ops.ts";

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

test("saving a filled TikTok message sends unless it was already sent unchanged", () => {
  const base = {
    tiktokOrderId: "576971003700747076",
    tiktokMessage: "Happy birthday",
    previousId: "",
    previousMessage: "",
    opsStatus: "",
    explicit: false,
  };
  assert.equal(shouldSendTiktokMessage(base), true);
  assert.equal(shouldSendTiktokMessage({ ...base, previousId: base.tiktokOrderId, previousMessage: base.tiktokMessage, opsStatus: "sent" }), false);
  assert.equal(shouldSendTiktokMessage({ ...base, previousId: base.tiktokOrderId, previousMessage: base.tiktokMessage, opsStatus: "failed" }), true);
  assert.equal(shouldSendTiktokMessage({ ...base, tiktokMessage: "  ", previousId: base.tiktokOrderId, previousMessage: "" }), false);
  assert.equal(shouldSendTiktokMessage({ ...base, explicit: true, tiktokMessage: "" }), true);
});

test("the orders app read is recognised only when it returns the message", () => {
  const local = "Happy birthday";
  assert.equal(interpretTiktokRead(401, '{"error":"Not signed in"}', local).state, "unavailable");
  assert.equal(interpretTiktokRead(401, "Bad token", local).label, "Could not check the orders app: Bad token");
  assert.equal(interpretTiktokRead(405, "", local).state, "unavailable");
  assert.equal(interpretTiktokRead(200, '{"ok":true}', local).state, "unavailable");
  assert.equal(interpretTiktokRead(200, '{"found":false}', local).state, "no_parcel");
  assert.equal(interpretTiktokRead(200, '{"found":true,"message":""}', local).state, "missing");
  assert.equal(interpretTiktokRead(200, `{"found":true,"message":${JSON.stringify(local)}}`, local).state, "has_message");
  assert.equal(interpretTiktokRead(200, '{"message":"A different note"}', local).state, "different");
  assert.equal(interpretTiktokRead(200, "<html>Not signed in</html>", local).state, "unavailable");
  const leaked = interpretTiktokRead(401, "Not signed in bearer secret-token-value", local);
  assert.equal(leaked.state, "unavailable");
  assert.equal(leaked.label.includes("secret-token-value"), false);
});

test("a read request uses the bearer token and does not follow a redirect", async () => {
  const previousUrl = process.env.OPS_APP_URL;
  const previousToken = process.env.OPS_API_TOKEN;
  process.env.OPS_APP_URL = "http://orders.test";
  process.env.OPS_API_TOKEN = "ops-test-token";
  try {
    let seen: { url: string; method: string; auth: string; redirect: string } | null = null;
    const result = await readTiktokMessage(LONG_ID, "Hello", (async (url, init) => {
      const headers = new Headers(init?.headers);
      seen = {
        url: String(url),
        method: String(init?.method ?? ""),
        auth: headers.get("authorization") ?? "",
        redirect: String(init?.redirect ?? ""),
      };
      return new Response('{"error":"Not signed in"}', { status: 401 });
    }) as typeof fetch);
    assert.equal(result.state, "unavailable");
    assert.equal(seen?.method, "GET");
    assert.equal(seen?.redirect, "manual");
    assert.equal(seen?.auth, "Bearer ops-test-token");
    assert.equal(seen?.url, `http://orders.test/api/tiktok/message?tiktok_order_id=${LONG_ID}`);
    assert.equal(syncSummary([]), "Nothing waiting to send.");
    assert.equal(syncSummary([{ name: "Ciara Stone", status: "sent", error: "" }]), "Sent Ciara Stone.");
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
