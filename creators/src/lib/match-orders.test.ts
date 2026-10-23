import assert from "node:assert/strict";
import test from "node:test";
import {
  interpretTiktokOrders,
  linesAfterSend,
  matchSummary,
  normalisePersonName,
  orderNeedsAction,
  planOrderMatches,
  readOrderAction,
  shouldPushSavedMessage,
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
    status: "",
    ...partial,
  };
}

test("names match with case, trim, and punctuation, and keep extra words", () => {
  assert.equal(normalisePersonName("  Ciara-Stone "), normalisePersonName("ciara stone"));
  assert.equal(normalisePersonName("Patricia\u00a0Fale"), normalisePersonName("patricia fale"));
  assert.notEqual(normalisePersonName("Amber"), normalisePersonName("Amber (Places We Found UK)"));
  assert.notEqual(normalisePersonName("Emily Blatchford"), normalisePersonName("Em (Emily Blatchford)"));
});

test("an order ID wins, then one unambiguous name, and the same message is not pushed again", () => {
  const rows = [
    creator({ id: "creator-katharine", name: "Katharine Cruse", tiktokMessage: "On the way" }),
    creator({ id: "creator-patricia", name: "Patricia Fale" }),
    creator({
      id: "creator-eva",
      name: "Someone Else",
      tiktokOrderId: "576971003700747100",
      tiktokMessage: "Already there",
    }),
  ];
  const parcels = [
    parcel({ tiktokOrderId: "576971003700747076", recipient: "katharine  cruse", freeSample: false, message: "" }),
    parcel({ tiktokOrderId: "576971003700747088", recipient: "Patricia Fale", freeSample: true, message: "" }),
    parcel({ tiktokOrderId: "576971003700747100", recipient: "Not Eva", message: "Already there" }),
    parcel({ tiktokOrderId: "576971003700747201", recipient: "Ciara Stone", reference: "#214410" }),
  ];
  const plan = planOrderMatches(rows, parcels);
  assert.deepEqual(
    plan.matches.map((item) => `${item.creatorId}:${item.by}`),
    ["creator-eva:id", "creator-katharine:name", "creator-patricia:name"],
  );
  assert.equal(plan.review.length, 0);
  assert.equal(plan.lines.find((line) => line.id === "creator-katharine")?.label, "Matched.");
  assert.equal(plan.unclaimed.map((item) => item.reference).join(","), "#214410");
  assert.equal(shouldPushSavedMessage("On the way", ""), true);
  assert.equal(shouldPushSavedMessage("  ", ""), false);
  assert.equal(shouldPushSavedMessage("Already there", " Already there "), false);
  assert.equal(shouldPushSavedMessage("On the way", "A different note"), true);
});

test("ambiguous names, a saved ID that disagrees, and a short name are left for review", () => {
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
  const plan = planOrderMatches(rows, parcels);
  assert.deepEqual(plan.matches, []);
  assert.equal(plan.lines.find((line) => line.id === "creator-a")?.label, "Needs review.");
  assert.equal(plan.lines.find((line) => line.id === "creator-amber")?.label, "Needs review.");
  assert.equal(plan.lines.find((line) => line.id === "creator-em")?.label, "No order found.");
  const sam = plan.review.find((item) => item.tiktokOrderId === "222");
  assert.deepEqual(sam?.candidates.map((item) => item.id).sort(), ["creator-a", "creator-b"]);
  assert.match(sam?.reason ?? "", /More than one/);
  assert.equal(plan.review.find((item) => item.tiktokOrderId === "333"), undefined);
  assert.match(plan.review.find((item) => item.tiktokOrderId === "555")?.reason ?? "", /does not match this order/);
  assert.deepEqual(
    plan.unclaimed.map((item) => item.tiktokOrderId).sort(),
    ["333", "444", "666"],
  );
});

test("a repeated or blank order ID does not hide the other order", () => {
  const repeated = planOrderMatches(
    [creator({ id: "creator-ciara", name: "Ciara Stone", tiktokMessage: "A note" })],
    [
      parcel({ tiktokOrderId: "100", recipient: "Ciara Stone", reference: "#214410" }),
      parcel({ tiktokOrderId: "100", recipient: "Someone Else", reference: "#9" }),
    ],
  );
  assert.deepEqual(repeated.matches, []);
  assert.equal(repeated.review.length, 2);
  assert.equal(repeated.lines[0].label, "No order found.");
  assert.equal(repeated.unclaimed.length, 0);

  const blank = planOrderMatches(
    [creator({ id: "creator-ciara", name: "Ciara Stone" })],
    [
      parcel({ tiktokOrderId: "", recipient: "Ciara Stone", reference: "#214410" }),
      parcel({ tiktokOrderId: "", recipient: "Millie", reference: "#2" }),
    ],
  );
  assert.equal(blank.matches.length, 1);
  assert.equal(blank.matches[0].by, "name");
  assert.equal(blank.matches[0].parcel.reference, "#214410");
  assert.deepEqual(
    blank.unclaimed.map((item) => item.reference),
    ["#2"],
  );

  const missing = interpretTiktokOrders(
    200,
    JSON.stringify({ orders: [{ tiktok_order_id: "", recipient_name: "Ciara Stone", reference: "#214410", has_message: false, message: "" }] }),
  );
  assert.equal(missing.state, "ready");
  if (missing.state === "ready") {
    assert.equal(missing.parcels.length, 1);
    assert.equal(missing.parcels[0].reference, "#214410");
    assert.equal(missing.review.length, 0);
  }
});

test("only a hold or a processed order with no message stays open", () => {
  const plan = planOrderMatches(
    [],
    [
      parcel({ tiktokOrderId: "1", recipient: "Ciara Stone", reference: "#214410", status: "on_hold" }),
      parcel({ tiktokOrderId: "2", recipient: "Ava Processed", reference: "#2", status: "processed" }),
      parcel({ tiktokOrderId: "3", recipient: "Bea Done", reference: "#3", status: "processed", hasMessage: true, message: "Already written" }),
      parcel({ tiktokOrderId: "4", recipient: "Cara Complete", reference: "#4", status: "complete" }),
      parcel({ tiktokOrderId: "5", recipient: "Dina Cancelled", reference: "#5", status: "cancelled" }),
      parcel({ tiktokOrderId: "6", recipient: "Eve Hold", reference: "#6", status: "On hold", message: "Waiting" }),
    ],
  );
  assert.deepEqual(
    plan.unclaimed.map((item) => item.reference),
    ["#214410", "#2", "#6"],
  );
  assert.deepEqual(
    plan.older.map((item) => item.reference),
    ["#3", "#4", "#5"],
  );
  assert.equal(orderNeedsAction({ status: "processed", hasMessage: false, message: "  " }), true);
  assert.equal(orderNeedsAction({ status: "", hasMessage: false, message: "" }), true);
  assert.deepEqual(readOrderAction({ name: "  ", message: "Hello", noMessage: false }), { ok: false, error: "A name is required." });
  assert.deepEqual(readOrderAction({ name: "Ciara Stone", message: "  ", noMessage: false }), { ok: false, error: "Paste the note first." });
  assert.deepEqual(readOrderAction({ name: "Ciara Stone", message: "  Hello  ", noMessage: false }), {
    ok: true,
    name: "Ciara Stone",
    message: "Hello",
    noMessage: false,
  });
  assert.deepEqual(readOrderAction({ name: "Ciara Stone", message: "Do not store this", noMessage: true }), {
    ok: true,
    name: "Ciara Stone",
    message: "",
    noMessage: true,
  });
});

test("two parcels with one name are not assigned", () => {
  const plan = planOrderMatches(
    [creator({ id: "creator-eva", name: "Eva Wright", tiktokMessage: "Hello" })],
    [
      parcel({ tiktokOrderId: "100", recipient: "Eva Wright", reference: "#1" }),
      parcel({ tiktokOrderId: "200", recipient: "eva wright", reference: "#2" }),
    ],
  );
  assert.deepEqual(plan.matches, []);
  assert.equal(plan.review.length, 2);
  assert.deepEqual(plan.review[0].candidates.map((item) => item.name), ["Eva Wright"]);
  assert.equal(plan.lines[0].label, "Needs review.");

  const none = planOrderMatches([creator({ id: "creator-eva", name: "Eva Wright" })], []);
  assert.deepEqual(none.matches, []);
  assert.equal(none.lines[0].label, "No order found.");
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
    assert.deepEqual(numeric.review[0].candidates, []);
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
  assert.equal(matchSummary({ state: "not_ready", matched: 0, needsReview: 0, noOrder: 3, unclaimed: 0 }), "Orders app not ready.");
  const summary = matchSummary({ state: "matched", matched: 2, sent: 1, needsReview: 1, noOrder: 4, unclaimed: 5 });
  assert.equal(summary, "Matched 2. Sent 1. Needs review 1. No order found 4. Orders with no creator 5.");
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
