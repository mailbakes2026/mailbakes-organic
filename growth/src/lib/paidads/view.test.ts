import assert from "node:assert/strict";
import test from "node:test";
import { buildPaidView } from "./view.ts";
import type { Fact } from "./metrics.ts";

function row(date: string, spendPence: number, revenuePence: number, orders = 1): Fact {
  return {
    platform: "meta",
    level: "account",
    date,
    campaignId: "",
    campaignName: "",
    adsetId: "",
    adsetName: "",
    spendPence,
    revenuePence,
    orders,
    impressions: null,
    clicks: null,
    currency: "GBP",
    source: "meta",
  };
}

test("a day with no row stays empty instead of becoming zero", () => {
  const view = buildPaidView({
    rows: [row("2026-10-23", 1000, 2000)],
    today: "2026-10-23",
    range: "7d",
    metaConnected: true,
    googleRows: 0,
  });
  const missing = view.daily.filter((day) => day.date !== "2026-10-23");
  assert.equal(missing.every((day) => day.totals === null), true);
  assert.equal(view.daily.find((day) => day.date === "2026-10-23")?.totals?.spendPence, 1000);
});

test("no stored rows leaves the headline unset", () => {
  const view = buildPaidView({
    rows: [],
    today: "2026-10-23",
    range: "28d",
    metaConnected: false,
    googleRows: 0,
  });
  assert.equal(view.headline, null);
  assert.equal(view.roas, null);
  assert.equal(view.cpa, null);
  assert.equal(view.weeks.length, 0);
});

test("partial week comparison uses the same elapsed days", () => {
  const rows = [
    row("2026-10-20", 100, 1000, 2),
    row("2026-10-21", 100, 1000, 2),
    row("2026-10-13", 100, 800, 1),
    row("2026-10-14", 100, 800, 1),
  ];
  const view = buildPaidView({
    rows,
    today: "2026-10-21",
    range: "28d",
    metaConnected: true,
    googleRows: 0,
  });
  assert.equal(view.partial.current?.revenuePence, 2000);
  assert.equal(view.partial.previous?.revenuePence, 1600);
  assert.equal(view.partial.targetRevenuePence, 1680);
  assert.equal(view.partial.ahead, true);
});
