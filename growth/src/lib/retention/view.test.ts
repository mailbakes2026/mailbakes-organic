import assert from "node:assert/strict";
import test from "node:test";
import { buildRetentionView } from "./view.ts";

test("the retention view stays empty when nothing has been stored", () => {
  const view = buildRetentionView({ orders: [], lists: [], flows: [], campaigns: [] });
  assert.equal(view.repeat, null);
  assert.equal(view.cohorts, null);
  assert.equal(view.lists.length, 0);
  assert.equal(view.flows["30d"].length, 0);
});

test("cohort rates use the retained count and leave future months blank", () => {
  const view = buildRetentionView({
    orders: [
      { id: "1", customerId: "a", orderedOn: "2026-08-02" },
      { id: "2", customerId: "a", orderedOn: "2026-09-02" },
    ],
    lists: [],
    flows: [],
    campaigns: [],
  });
  assert.equal(view.cohorts?.rows[0]?.rates[0], 1);
  assert.equal(view.cohorts?.rows[0]?.rates[1], 1);
  assert.equal(view.cohorts?.rows[0]?.rates[2], null);
  assert.equal(view.repeat?.rateLabel, "100.0%");
});
