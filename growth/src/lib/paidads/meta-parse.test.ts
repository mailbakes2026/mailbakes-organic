import assert from "node:assert/strict";
import test from "node:test";
import { normaliseAccount, parseInsightRow, purchaseFromInsight, safeGraphNext } from "./meta-parse.ts";

test("purchase actions prefer omni_purchase and do not add the other types", () => {
  const picked = purchaseFromInsight(
    [
      { action_type: "purchase", value: "4" },
      { action_type: "omni_purchase", value: "3" },
      { action_type: "link_click", value: "9" },
    ],
    [
      { action_type: "purchase", value: "40" },
      { action_type: "omni_purchase", value: "30.5" },
    ],
  );
  assert.equal(picked.used, "omni_purchase");
  assert.equal(picked.orders, 3);
  assert.equal(picked.revenue, 30.5);
});

test("a row with spend and no purchase action stores zero orders, not a blank", () => {
  const row = parseInsightRow(
    { date_start: "2026-10-22", spend: "10.00", account_currency: "GBP", impressions: "100" },
    "account",
  );
  assert.equal(row?.orders, 0);
  assert.equal(row?.revenuePence, 0);
  assert.equal(row?.spendPence, 1000);
  assert.equal(row?.impressions, 100);
});

test("a row without spend or currency is dropped", () => {
  assert.equal(parseInsightRow({ date_start: "2026-10-22", account_currency: "GBP" }, "account"), null);
  assert.equal(parseInsightRow({ date_start: "2026-10-22", spend: "1.00" }, "account"), null);
});

test("account ids gain the act_ prefix and paging stays on the graph host", () => {
  assert.equal(normaliseAccount("123"), "act_123");
  assert.equal(normaliseAccount("act_99"), "act_99");
  assert.equal(safeGraphNext("https://graph.facebook.com/v21.0/act_1/insights?after=abc"), "https://graph.facebook.com/v21.0/act_1/insights?after=abc");
  assert.equal(safeGraphNext("https://evil.example/next"), null);
});
