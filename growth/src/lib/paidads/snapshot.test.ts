import assert from "node:assert/strict";
import test from "node:test";
import type { Fact } from "./metrics.ts";
import { buildMetaSnapshot, type ShopifyOrderFact } from "./snapshot.ts";

function row(partial: Partial<Fact> & Pick<Fact, "date" | "level">): Fact {
  return {
    platform: "meta",
    campaignId: "",
    campaignName: "",
    adsetId: "",
    adsetName: "",
    adId: "",
    adName: "",
    spendPence: 0,
    revenuePence: 0,
    orders: 0,
    impressions: null,
    clicks: null,
    currency: "GBP",
    source: "meta",
    ...partial,
  };
}

const TODAY = "2026-11-03";

const orders: ShopifyOrderFact[] = [
  { customerId: "old", orderedOn: "2026-09-01", totalPence: 1000, currency: "GBP" },
  { customerId: "old", orderedOn: "2026-11-03", totalPence: 4000, currency: "GBP" },
  { customerId: "new", orderedOn: "2026-11-02", totalPence: 6000, currency: "GBP" },
  { customerId: "", orderedOn: "2026-10-28", totalPence: 1000, currency: "GBP" },
];

test("today, yesterday and 7 days use Meta for ROAS and Shopify for MER", () => {
  const snapshot = buildMetaSnapshot({
    today: TODAY,
    orders,
    rows: [
      row({ date: "2026-11-03", level: "account", spendPence: 3000, revenuePence: 9000, orders: 3 }),
      row({ date: "2026-11-03", level: "campaign", spendPence: 99999, revenuePence: 1, orders: 9 }),
      row({ date: "2026-11-02", level: "account", spendPence: 2000, revenuePence: 4000, orders: 2 }),
      row({ date: "2026-10-28", level: "account", spendPence: 5000, revenuePence: 5000, orders: 1 }),
      row({ date: "2026-11-03", level: "ad", adId: "huge", adName: "Huge", spendPence: 80000, revenuePence: 1, orders: 1 }),
    ],
  });
  const today = snapshot.windows.find((window) => window.key === "today");
  const yesterday = snapshot.windows.find((window) => window.key === "yesterday");
  const week = snapshot.windows.find((window) => window.key === "seven");
  assert.equal(today?.spendLabel, "£30.00");
  assert.equal(today?.purchasesLabel, "3");
  assert.equal(today?.roasLabel, "3.00×");
  assert.equal(today?.merLabel, "1.33×");
  assert.equal(today?.shopifyLabel, "£40.00");
  assert.equal(yesterday?.spendLabel, "£20.00");
  assert.equal(yesterday?.roasLabel, "2.00×");
  assert.equal(yesterday?.merLabel, "3.00×");
  assert.equal(yesterday?.shopifyLabel, "£60.00");
  assert.equal(week?.spendPence, 10000);
  assert.equal(week?.purchases, 6);
  assert.equal(week?.roasLabel, "1.80×");
  assert.equal(week?.merLabel, "1.10×");
  assert.equal(week?.shopifyLabel, "£110.00");
  assert.equal(week?.audience.newLabel, "£60.00 · 1 customer");
  assert.equal(week?.audience.returningLabel, "£40.00 · 1 customer");
  assert.match(week?.audience.note ?? "", /1 guest order/);
});

test("a day with no Meta row stays blank", () => {
  const snapshot = buildMetaSnapshot({
    today: TODAY,
    orders: [],
    rows: [row({ date: "2026-11-02", level: "account", spendPence: 2000, revenuePence: 2000, orders: 1 })],
  });
  const today = snapshot.windows.find((window) => window.key === "today");
  assert.equal(today?.spendPence, null);
  assert.equal(today?.spendLabel, "—");
  assert.equal(today?.purchasesLabel, "—");
  assert.equal(today?.roasLabel, "—");
  assert.equal(today?.merLabel, "—");
});

test("top and bottom five ads need £50 and are ranked by ROAS", () => {
  const ranked = [
    ["A", 5000, 25000],
    ["B", 5000, 20000],
    ["C", 5000, 15000],
    ["D", 5000, 10000],
    ["E", 5000, 5000],
    ["F", 6000, 3000],
    ["G", 7000, 1400],
    ["H", 8000, 800],
    ["I", 9000, 0],
    ["J", 10000, 0],
  ] as const;
  const rows = ranked.map(([name, spendPence, revenuePence], index) =>
    row({
      date: "2026-11-01",
      level: "ad",
      adId: name,
      adName: name,
      campaignName: "Always on",
      adsetName: "Prospecting",
      spendPence,
      revenuePence,
      orders: index,
    }),
  );
  rows.push(
    row({ date: "2026-11-01", level: "ad", adId: "tiny", adName: "Tiny", spendPence: 4999, revenuePence: 20000, orders: 4 }),
    row({ date: "2026-10-01", level: "ad", adId: "old", adName: "Old", spendPence: 20000, revenuePence: 80000, orders: 8 }),
    row({
      date: "2026-11-01",
      level: "ad",
      adId: "usd",
      adName: "Dollar",
      spendPence: 20000,
      revenuePence: 80000,
      orders: 2,
      currency: "USD",
    }),
    row({ date: "2026-11-01", level: "ad", adId: "split", adName: "Split", spendPence: 3000, revenuePence: 0, orders: 0 }),
    row({ date: "2026-11-02", level: "ad", adId: "split", adName: "Split", spendPence: 3000, revenuePence: 6000, orders: 1 }),
  );
  const snapshot = buildMetaSnapshot({ today: TODAY, orders: [], rows });
  assert.deepEqual(
    snapshot.top.map((ad) => ad.name),
    ["A", "B", "C", "D", "Split"],
  );
  assert.deepEqual(
    snapshot.bottom.map((ad) => ad.name),
    ["J", "I", "H", "G", "F"],
  );
  assert.equal(snapshot.top[0]?.roasLabel, "5.00×");
  assert.equal(snapshot.top[4]?.spendPence, 6000);
  assert.equal(snapshot.top[4]?.roasLabel, "1.00×");
  assert.equal(snapshot.belowMinimum, 1);
  assert.equal(snapshot.rankedCount, 11);
  assert.match(snapshot.adNote ?? "", /another currency/);
  assert.equal(snapshot.top.some((ad) => ad.name === "Tiny" || ad.name === "Old" || ad.name === "Dollar"), false);
  assert.equal(snapshot.bottom.some((ad) => ad.name === "Tiny" || ad.name === "Old" || ad.name === "Dollar" || ad.name === "E"), false);
});
