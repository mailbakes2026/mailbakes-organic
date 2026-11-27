import assert from "node:assert/strict";
import test from "node:test";
import { combineMoney, priorPulse, relativeChange, sumMoney, trailingRepeat, weekStory } from "./weeks.ts";

test("revenue sums one currency and refuses a mix", () => {
  assert.equal(sumMoney([{ revenuePence: 100, currency: "GBP" }, { revenuePence: 50, currency: "GBP" }]).pence, 150);
  assert.equal(sumMoney([{ revenuePence: 100, currency: "GBP" }, { revenuePence: 50, currency: "USD" }]).mixed, true);
  assert.equal(sumMoney([{ revenuePence: null, currency: "GBP" }]).pence, null);
  const parts = combineMoney({ pence: 100, currency: "GBP", mixed: false }, { pence: null, currency: "GBP", mixed: false });
  assert.equal(parts.pence, null);
});

test("a percent change needs a prior figure that is not zero", () => {
  assert.equal(relativeChange(110, 100).direction, "up");
  assert.equal(relativeChange(90, 100).direction, "down");
  assert.equal(relativeChange(100, 100).direction, "flat");
  assert.equal(relativeChange(10, null).direction, "unknown");
  assert.equal(relativeChange(10, 0).direction, "unknown");
});

test("repeat rate uses orders before the 7-day window", () => {
  const orders = [
    { customerId: "a", orderedOn: "2026-11-01" },
    { customerId: "a", orderedOn: "2026-11-20" },
    { customerId: "b", orderedOn: "2026-11-22" },
    { customerId: "", orderedOn: "2026-11-22" },
  ];
  const summary = trailingRepeat(orders, "2026-11-26");
  assert.equal(summary?.customers, 2);
  assert.equal(summary?.repeatCustomers, 1);
  assert.equal(summary?.rate, 0.5);
  assert.equal(trailingRepeat([], "2026-11-26"), null);
});

test("week on week waits until a previous week is stored", () => {
  const current = {
    capturedOn: "2026-11-26",
    flowRevenuePence: 2000,
    campaignRevenuePence: 1000,
    currency: "GBP",
    mixedCurrency: false,
    repeatRate: 0.4,
    repeatCustomers: 2,
    customers: 5,
  };
  const empty = weekStory({ today: "2026-11-26", current, pulses: [current], calendar: [] });
  assert.equal(empty.cards.find((card) => card.key === "total")?.pence, 3000);
  assert.equal(empty.cards.find((card) => card.key === "total")?.direction, "unknown");
  assert.equal(empty.compared, false);
  assert.equal(empty.bars.at(-1)?.flowPence, 2000);

  const prior = { ...current, capturedOn: "2026-11-19", flowRevenuePence: 1000, campaignRevenuePence: 1000, repeatRate: 0.2 };
  const story = weekStory({ today: "2026-11-26", current, pulses: [prior, current], calendar: [] });
  assert.equal(story.cards.find((card) => card.key === "flow")?.direction, "up");
  assert.equal(story.cards.find((card) => card.key === "campaign")?.direction, "flat");
  assert.equal(story.cards.find((card) => card.key === "repeat")?.direction, "up");
  assert.equal(story.compared, true);
  assert.equal(priorPulse([prior, current], "2026-11-26")?.capturedOn, "2026-11-19");
});

test("calendar results fill campaign weeks that have no sync snapshot", () => {
  const current = {
    capturedOn: "2026-11-26",
    flowRevenuePence: null,
    campaignRevenuePence: null,
    currency: "GBP",
    mixedCurrency: false,
    repeatRate: null,
    repeatCustomers: null,
    customers: null,
  };
  const story = weekStory({
    today: "2026-11-26",
    current,
    pulses: [],
    calendar: [{ sendDate: "2026-11-18", revenuePence: 500, currency: "GBP" }],
  });
  const week = story.bars.find((bar) => bar.weekStart === "2026-11-16");
  assert.equal(week?.campaignPence, 500);
  assert.equal(week?.flowPence, null);
});
