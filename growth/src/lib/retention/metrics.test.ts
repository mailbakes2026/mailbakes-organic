import assert from "node:assert/strict";
import test from "node:test";
import { cohortRetention, listGrowth, preferLatest, repeatPurchase } from "./metrics.ts";

test("repeat rate ignores guest orders and does not treat one order as a repeat", () => {
  const summary = repeatPurchase([
    { id: "1", customerId: "a", orderedOn: "2026-01-02" },
    { id: "2", customerId: "a", orderedOn: "2026-03-02" },
    { id: "3", customerId: "b", orderedOn: "2026-02-02" },
    { id: "4", customerId: "", orderedOn: "2026-02-03" },
  ]);
  assert.equal(summary?.customers, 2);
  assert.equal(summary?.repeatCustomers, 1);
  assert.equal(summary?.rate, 0.5);
  assert.equal(summary?.guestOrders, 1);
  assert.equal(summary?.histogram[0]?.count, 1);
  assert.equal(summary?.histogram[1]?.count, 1);
});

test("no orders is missing, not a zero rate", () => {
  assert.equal(repeatPurchase([]), null);
  assert.equal(repeatPurchase([{ id: "1", customerId: "", orderedOn: "2026-01-01" }]), null);
});

test("cohort cells after the latest month stay blank", () => {
  const table = cohortRetention([
    { id: "1", customerId: "a", orderedOn: "2026-08-04" },
    { id: "2", customerId: "a", orderedOn: "2026-09-04" },
    { id: "3", customerId: "b", orderedOn: "2026-08-11" },
  ]);
  assert.equal(table?.latest, "2026-09");
  const august = table?.rows.find((row) => row.cohort === "2026-08");
  assert.equal(august?.customers, 2);
  assert.equal(august?.retained[0], 2);
  assert.equal(august?.retained[1], 1);
  assert.equal(august?.retained[2], null);
});

test("list growth needs two dates", () => {
  const rows = listGrowth([
    { listId: "l1", listName: "Main", profiles: 100, capturedOn: "2026-10-22" },
    { listId: "l1", listName: "Main", profiles: 110, capturedOn: "2026-10-23" },
    { listId: "l2", listName: "SMS", profiles: 5, capturedOn: "2026-10-23" },
  ]);
  const main = rows.find((row) => row.latest.listId === "l1");
  const sms = rows.find((row) => row.latest.listId === "l2");
  assert.equal(main?.delta, 10);
  assert.equal(sms?.delta, null);
});

test("the newer source wins when both connectors and ingest stored a flow", () => {
  const rows = preferLatest([
    {
      id: "f",
      name: "Welcome",
      window: "30d",
      revenuePence: 100,
      opens: 1,
      clicks: 1,
      delivered: 2,
      unsubscribes: 0,
      openRate: 0.5,
      clickRate: 0.5,
      currency: "GBP",
      source: "klaviyo",
      updatedAt: "2026-10-22T10:00:00.000Z",
    },
    {
      id: "f",
      name: "Welcome",
      window: "30d",
      revenuePence: 200,
      opens: null,
      clicks: null,
      delivered: null,
      unsubscribes: null,
      openRate: null,
      clickRate: null,
      currency: "GBP",
      source: "ingest",
      updatedAt: "2026-10-23T10:00:00.000Z",
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.source, "ingest");
  assert.equal(rows[0]?.revenuePence, 200);
  assert.equal(rows[0]?.opens, null);
});
