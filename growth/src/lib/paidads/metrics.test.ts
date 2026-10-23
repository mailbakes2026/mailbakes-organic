import assert from "node:assert/strict";
import test from "node:test";
import { compareTotals, headlineLevel, sumFacts, wowWindows, type Fact } from "./metrics.ts";

function fact(partial: Partial<Fact> & Pick<Fact, "date" | "level">): Fact {
  return {
    platform: "meta",
    campaignId: "",
    campaignName: "",
    adsetId: "",
    adsetName: "",
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

test("an empty set is missing, not zero", () => {
  assert.equal(sumFacts([]), null);
});

test("mixed currencies are not added", () => {
  const rows = [
    fact({ date: "2026-10-20", level: "account", spendPence: 100, currency: "GBP" }),
    fact({ date: "2026-10-21", level: "account", spendPence: 100, currency: "USD" }),
  ];
  assert.equal(sumFacts(rows), null);
});

test("account rows win over campaign rows for the headline", () => {
  const rows = [
    fact({ date: "2026-10-20", level: "campaign", spendPence: 500 }),
    fact({ date: "2026-10-20", level: "account", spendPence: 800 }),
  ];
  assert.equal(headlineLevel(rows), "account");
});

test("the 5% target is last week's revenue plus 5%", () => {
  const current = sumFacts([fact({ date: "2026-10-20", level: "account", spendPence: 1000, revenuePence: 2100, orders: 4 })]);
  const previous = sumFacts([fact({ date: "2026-10-13", level: "account", spendPence: 900, revenuePence: 2000, orders: 3 })]);
  const compared = compareTotals(current, previous);
  assert.equal(compared.targetRevenuePence, 2100);
  assert.equal(compared.ahead, true);
  assert.equal(compared.revenueChange, 0.05);
});

test("a prior week with no revenue does not invent a target", () => {
  const current = sumFacts([fact({ date: "2026-10-20", level: "account", revenuePence: 500, spendPence: 100, orders: 1 })]);
  const previous = sumFacts([fact({ date: "2026-10-13", level: "account", revenuePence: 0, spendPence: 100, orders: 0 })]);
  const compared = compareTotals(current, previous);
  assert.equal(compared.targetRevenuePence, null);
  assert.equal(compared.revenueChange, null);
  assert.match(compared.reason ?? "", /no revenue/);
});

test("week windows use the same number of days", () => {
  const windows = wowWindows("2026-10-23");
  assert.equal(windows.thisPartial.from, "2026-10-19");
  assert.equal(windows.thisPartial.to, "2026-10-23");
  assert.equal(windows.prevPartial.from, "2026-10-12");
  assert.equal(windows.prevPartial.to, "2026-10-16");
  assert.equal(windows.elapsed, 5);
});
