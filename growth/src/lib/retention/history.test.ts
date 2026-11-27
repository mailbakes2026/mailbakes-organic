import assert from "node:assert/strict";
import test from "node:test";
import { londonStamp } from "../dates.ts";
import { historyTargets, historyWeeks, windowRepeat } from "./weeks.ts";

test("eight London weeks end on today when the week is unfinished", () => {
  const weeks = historyWeeks("2026-11-27", 8);
  assert.equal(weeks.length, 8);
  assert.equal(weeks[0]?.start, "2026-10-05");
  assert.equal(weeks.at(-1)?.start, "2026-11-23");
  assert.equal(weeks.at(-1)?.capturedOn, "2026-11-27");
  assert.equal(weeks.at(-1)?.partial, true);
  assert.equal(weeks.at(-2)?.end, "2026-11-22");
});

test("history targets keep the previous 7 days first and skip today", () => {
  const targets = historyTargets("2026-11-27", 8);
  assert.equal(targets[0]?.storeSends, true);
  assert.deepEqual(targets[0]?.capturedOn, ["2026-11-20"]);
  assert.equal(targets[0]?.start, "2026-11-14");
  assert.equal(targets.some((target) => target.capturedOn.includes("2026-11-27")), false);
  assert.equal(targets.length, 8);
});

test("repeat rate for a calendar week ignores orders after it", () => {
  const orders = [
    { customerId: "a", orderedOn: "2026-11-01" },
    { customerId: "a", orderedOn: "2026-11-18" },
    { customerId: "b", orderedOn: "2026-11-20" },
    { customerId: "c", orderedOn: "2026-11-25" },
  ];
  const summary = windowRepeat(orders, "2026-11-16", "2026-11-22");
  assert.equal(summary?.customers, 2);
  assert.equal(summary?.repeatCustomers, 1);
  assert.equal(summary?.rate, 0.5);
});

test("London stamps use GMT in winter and BST in summer", () => {
  assert.equal(londonStamp("2026-01-15", false), "2026-01-15T00:00:00+00:00");
  assert.equal(londonStamp("2026-07-15", true), "2026-07-15T23:59:59+01:00");
  assert.equal(londonStamp("2026-11-27", false), "2026-11-27T00:00:00+00:00");
  assert.equal(londonStamp("nope", false), null);
});
