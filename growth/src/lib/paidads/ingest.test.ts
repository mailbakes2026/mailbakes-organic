import assert from "node:assert/strict";
import test from "node:test";
import { parsePaidIngest } from "./ingest.ts";

test("a daily row is stored in pence without filling blanks", () => {
  const parsed = parsePaidIngest({
    platform: "meta",
    currency: "GBP",
    rows: [{ date: "2026-10-22", level: "account", spend: "12.50", revenue: 40, orders: 2 }],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.rows[0]?.spendPence, 1250);
  assert.equal(parsed.rows[0]?.revenuePence, 4000);
  assert.equal(parsed.rows[0]?.impressions, null);
});

test("missing metrics are rejected instead of stored as zero", () => {
  const parsed = parsePaidIngest({
    platform: "meta",
    currency: "GBP",
    rows: [{ date: "2026-10-22", level: "account", spend: 10, orders: 1 }],
  });
  assert.equal(parsed.ok, false);
});

test("google rows can be ingested while the live connector stays parked", () => {
  const parsed = parsePaidIngest({
    platform: "google",
    currency: "gbp",
    rows: [{ date: "2026-10-22", level: "campaign", campaignName: "Brand", spend: 1, revenue: 2, orders: 0 }],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.rows[0]?.currency, "GBP");
  assert.equal(parsed.rows[0]?.orders, 0);
});
