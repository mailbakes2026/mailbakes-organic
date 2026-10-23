import assert from "node:assert/strict";
import test from "node:test";
import {
  interpretTiktokOrders,
  linesAfterSend,
  matchSummary,
  normalisePersonName,
  planNameMatches,
  shouldPostMatchedMessage,
  type NameCreator,
  type TikTokParcel,
} from "./match-orders.ts";
import { opsGet } from "./ops.ts";
import { MATCH_INTERVAL_MS, startTiktokMatchSchedule } from "./match-schedule.ts";

const SECRET = "ops-test-token-do-not-print";

function creator(partial: Partial<NameCreator> & { id: string; name: string }): NameCreator {
  return {
    tiktokOrderId: "",
    tiktokMessage: "",
    opsStatus: "",
    ...partial,
  };
}

function parcel(partial: Partial<TikTokParcel> & { tiktokOrderId: string; recipient: string }): TikTokParcel {
  return {
    reference: "",
    freeSample: false,
    hasMessage: false,
    message: "",
    ...partial,
  };
}

test("names match with case, whitespace, and accents, and keep parentheses", () => {
  assert.equal(normalisePersonName("  José\u00a0Álvarez  "), normalisePersonName("jose alvarez"));
  assert.notEqual(normalisePersonName("Amber"), normalisePersonName("Amber (Places We Found UK)"));
  assert.notEqual(normalisePersonName("Emily Blatchford"), normalisePersonName("Em (Emily Blatchford)"));
});

test("a unique name fills a match and a saved message is posted unless that same ID was already sent", () => {
  const rows = [
    creator({ id: "creator-katharine", name: "Katharine Cruse", tiktokMessage: "On the way" }),
    creator({ id: "creator-patricia", name: "Patricia Fale" }),
    creator({
      id: "creator-eva",
      name: "Eva Wright",
      tiktokOrderId: "576971003700747100",
      tiktokMessage: "Already there",
      opsStatus: "sent",
    }),
  ];
  const parcels = [
    parcel({ tiktokOrderId: "576971003700747076", recipient: "katharine  cruse", freeSample: false }),
    parcel({ tiktokOrderId: "576971003700747088", recipient: "Patricia Fale", freeSample: true }),
    parcel({ tiktokOrderId: "576971003700747100", recipient: "Eva Wright" }),
  ];
  const plan = planNameMatches(rows, parcels);
  assert.deepEqual(
    plan.matches.map((item) => item.creatorId),
    ["creator-katharine", "creator-patricia", "creator-eva"],
  );
  assert.equal(plan.review.length, 0);
  assert.equal(plan.lines.find((line) => line.id === "creator-katharine")?.label, "Matched.");
  assert.equal(plan.lines.find((line) => line.id === "creator-patricia")?.label, "Matched.");
  assert.equal(plan.lines.find((line) => line.id === "creator-eva")?.label, "Sent.");
  assert.equal(
    shouldPostMatchedMessage({ tiktokMessage: "On the way", tiktokOrderId: "", parcelId: "576971003700747076", opsStatus: "" }),
    true,
  );
  assert.equal(
    shouldPostMatchedMessage({ tiktokMessage: "", tiktokOrderId: "", parcelId: "576971003700747088", opsStatus: "" }),
    false,
  );
  assert.equal(
    shouldPostMatchedMessage({
      tiktokMessage: "Already there",
      tiktokOrderId: "576971003700747100",
      parcelId: "576971003700747100",
      opsStatus: "sent",
    }),
    false,
  );
  assert.equal(
    shouldPostMatchedMessage({ tiktokMessage: "On the way", tiktokOrderId: "", parcelId: "576971003700747076", opsStatus: "sent" }),
    true,
  );
});

test("ambiguous names, a different saved ID, and a short name are left for confirmation", () => {
  const rows = [
    creator({ id: "creator-a", name: "Sam" }),
    creator({ id: "creator-b", name: "sam" }),
    creator({ id: "creator-amber", name: "Amber (Places We Found UK)", tiktokOrderId: "111" }),
    creator({ id: "creator-em", name: "Em (Emily Blatchford)" }),
  ];
  const parcels = [
    parcel({ tiktokOrderId: "222", recipient: "Sam", reference: "#1" }),
    parcel({ tiktokOrderId: "333", recipient: "Amber", reference: "#2" }),
    parcel({ tiktokOrderId: "444", recipient: "Emily Blatchford", reference: "#3" }),
    parcel({ tiktokOrderId: "555", recipient: "Amber (Places We Found UK)", reference: "#4" }),
    parcel({ tiktokOrderId: "666", recipient: "  ", reference: "#5" }),
  ];
  const plan = planNameMatches(rows, parcels);
  assert.deepEqual(plan.matches, []);
  assert.equal(plan.lines.every((line) => line.state === "unmatched"), true);
  assert.match(plan.lines.find((line) => line.id === "creator-a")?.label ?? "", /More than one/);
  assert.match(plan.lines.find((line) => line.id === "creator-amber")?.label ?? "", /different TikTok order ID/);
  const reasons = plan.review.map((item) => `${item.tiktokOrderId}:${item.reason}`);
  assert.equal(reasons.some((reason) => reason.startsWith("222:") && /More than one/.test(reason)), true);
  assert.equal(reasons.some((reason) => reason.startsWith("333:") && reason.endsWith("Unmatched.")), true);
  assert.equal(reasons.some((reason) => reason.startsWith("444:") && reason.endsWith("Unmatched.")), true);
  assert.match(reasons.find((reason) => reason.startsWith("555:")) ?? "", /different TikTok order ID/);
  assert.match(reasons.find((reason) => reason.startsWith("666:")) ?? "", /recipient name/);
});

test("two parcels with one name are not assigned", () => {
  const plan = planNameMatches(
    [creator({ id: "creator-eva", name: "Eva Wright", tiktokMessage: "Hello" })],
    [
      parcel({ tiktokOrderId: "100", recipient: "Eva Wright", reference: "#1" }),
      parcel({ tiktokOrderId: "200", recipient: "eva wright", reference: "#2" }),
    ],
  );
  assert.deepEqual(plan.matches, []);
  assert.equal(plan.review.length, 2);
  assert.match(plan.lines[0].label, /More than one/);

  const none = planNameMatches([creator({ id: "creator-eva", name: "Eva Wright" })], []);
  assert.deepEqual(none.matches, []);
  assert.equal(none.lines[0].label, "Unmatched.");
});

test("the orders list accepts text IDs and treats a missing route as not ready", () => {
  const ready = interpretTiktokOrders(
    200,
    JSON.stringify({
      parcels: [
        {
          shopify_reference: "#214508",
          tiktok_order_id: "576971003700747076",
          recipient_name: "Katharine Cruse",
          free_sample: true,
          has_message: false,
        },
      ],
    }),
  );
  assert.equal(ready.state, "ready");
  if (ready.state === "ready") {
    assert.equal(ready.parcels[0].tiktokOrderId, "576971003700747076");
    assert.equal(ready.parcels[0].freeSample, true);
    assert.equal(ready.parcels[0].reference, "#214508");
  }

  const numeric = interpretTiktokOrders(200, JSON.stringify([{ tiktok_order_id: 576971003700747076, recipient: "Katharine Cruse" }]));
  assert.equal(numeric.state, "ready");
  if (numeric.state === "ready") {
    assert.equal(numeric.parcels.length, 0);
    assert.match(numeric.review[0].reason, /not text/);
    assert.equal(numeric.review[0].tiktokOrderId, "");
  }

  assert.equal(interpretTiktokOrders(404, "not found").state, "not_ready");
  assert.equal(interpretTiktokOrders(405, "").state, "not_ready");
  assert.equal(interpretTiktokOrders(501, "").state, "not_ready");
  assert.equal(interpretTiktokOrders(401, '{"error":"Not signed in"}').state, "not_ready");
  assert.equal(interpretTiktokOrders(200, "<!doctype html><html></html>").state, "not_ready");
  assert.equal(interpretTiktokOrders(200, '{"ok":true}').state, "not_ready");
  assert.equal(interpretTiktokOrders(200, "not json").state, "not_ready");

  const denied = interpretTiktokOrders(401, `Bad token bearer ${SECRET}`);
  assert.deepEqual(denied, { state: "failed", error: "Bad token" });
  assert.equal(JSON.stringify(denied).includes(SECRET), false);

  const empty = interpretTiktokOrders(200, '{"orders":[]}');
  assert.equal(empty.state, "ready");
  assert.equal(matchSummary({ state: "not_ready", matched: 0, sent: 0, unmatched: 3 }), "Orders app not ready.");
  const summary = matchSummary({ state: "matched", matched: 1, sent: 1, unmatched: 7 });
  assert.equal(summary, "Matched 1. Sent 1. Unmatched 7.");
  assert.match(matchSummary({ state: "failed", error: `bearer ${SECRET}`, matched: 0, sent: 0, unmatched: 0 }), /^Failed: bearer\.?$|^Failed: bearer$/);
  assert.equal(matchSummary({ state: "failed", error: `bearer ${SECRET}`, matched: 0, sent: 0, unmatched: 0 }).includes(SECRET), false);
});

test("a failed send replaces the matched line and drops a bearer secret", () => {
  const lines = linesAfterSend(
    [{ id: "creator-katharine", state: "matched", label: "Matched." }],
    new Set(),
    [{ id: "creator-katharine", error: `nope bearer ${SECRET}` }],
  );
  assert.equal(lines[0].state, "failed");
  assert.equal(lines[0].label.includes(SECRET), false);
  assert.match(lines[0].label, /^Failed: /);
});

test("the machine orders route is a bearer GET and the token stays out of the result", async () => {
  const previousUrl = process.env.OPS_APP_URL;
  const previousToken = process.env.OPS_API_TOKEN;
  process.env.OPS_APP_URL = "http://orders.test/api/tiktok/message";
  process.env.OPS_API_TOKEN = SECRET;
  try {
    let seen: { url: string; method: string; redirect: string; auth: string } | null = null;
    const result = await opsGet("/api/machine/tiktok-orders", (async (url, init) => {
      const headers = new Headers(init?.headers);
      seen = {
        url: String(url),
        method: String(init?.method ?? ""),
        redirect: String(init?.redirect ?? ""),
        auth: headers.get("authorization") ?? "",
      };
      return new Response("missing", { status: 404 });
    }) as typeof fetch);
    assert.equal(seen?.url, "http://orders.test/api/machine/tiktok-orders");
    assert.equal(seen?.method, "GET");
    assert.equal(seen?.redirect, "manual");
    assert.equal(seen?.auth, `Bearer ${SECRET}`);
    assert.equal(result.ok, true);
    if (result.ok) {
      const interpreted = interpretTiktokOrders(result.status, result.body);
      assert.equal(interpreted.state, "not_ready");
      assert.equal(JSON.stringify(interpreted).includes(SECRET), false);
    }
  } finally {
    if (previousUrl === undefined) delete process.env.OPS_APP_URL;
    else process.env.OPS_APP_URL = previousUrl;
    if (previousToken === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previousToken;
  }
});

test("the match schedule waits ten minutes and does not run at startup", () => {
  assert.equal(MATCH_INTERVAL_MS, 600_000);
  const original = globalThis.setInterval;
  const scope = globalThis as typeof globalThis & { __mbTiktokMatch?: boolean };
  delete scope.__mbTiktokMatch;
  let delay = 0;
  let registrations = 0;
  let ran = false;
  globalThis.setInterval = ((fn: () => void, ms?: number) => {
    registrations += 1;
    delay = ms ?? 0;
    void fn;
    return { unref() {} } as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;
  try {
    startTiktokMatchSchedule(async () => {
      ran = true;
    });
    startTiktokMatchSchedule(async () => {
      ran = true;
    });
    assert.equal(registrations, 1);
    assert.equal(delay, 600_000);
    assert.equal(ran, false);
  } finally {
    globalThis.setInterval = original;
    delete scope.__mbTiktokMatch;
  }
});
