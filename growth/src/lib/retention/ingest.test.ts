import assert from "node:assert/strict";
import test from "node:test";
import { parseRetentionIngest } from "./ingest.ts";

test("omitted flow metrics stay null", () => {
  const parsed = parseRetentionIngest({
    flows: [{ id: "F", name: "Welcome", window: "30d", revenue: "19.99", currency: "GBP" }],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.flows[0]?.revenuePence, 1999);
  assert.equal(parsed.value.flows[0]?.opens, null);
  assert.equal(parsed.value.flows[0]?.openRate, null);
});

test("an empty payload is rejected", () => {
  assert.equal(parseRetentionIngest({}).ok, false);
});

test("orders without a customer id are kept as guests", () => {
  const parsed = parseRetentionIngest({
    orders: [{ id: "o1", orderedOn: "2026-10-01", total: 12, currency: "GBP" }],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.orders[0]?.customerId, "");
});
