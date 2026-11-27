import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignNamePath,
  choosePlacedOrder,
  parseAccountCurrency,
  parseCampaignMessage,
  parseCampaignPerformance,
  parseFlowList,
  parseLists,
  parseTemplateHtml,
  parseMetricCatalog,
  parsePlacedOrderMetric,
  parseValuesReport,
  retryWaitMs,
  safeKlaviyoNext,
  shopifyMetricsPath,
} from "./klaviyo-parse.ts";

test("flow messages are summed and rates are recomputed", () => {
  const rows = parseValuesReport(
    {
      data: {
        attributes: {
          results: [
            {
              groupings: { flow_id: "F1", flow_message_id: "M1" },
              statistics: { conversion_value: 10, opens: 4, clicks: 1, delivered: 8, unsubscribes: 1 },
            },
            {
              groupings: { flow_id: "F1", flow_message_id: "M2" },
              statistics: { conversion_value: 5.5, opens: 1, clicks: 0, delivered: 2, unsubscribes: 0 },
            },
          ],
        },
      },
    },
    "30d",
    ["flow_id"],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.revenuePence, 1550);
  assert.equal(rows[0]?.opens, 5);
  assert.equal(rows[0]?.delivered, 10);
  assert.equal(rows[0]?.openRate, 0.5);
  assert.equal(rows[0]?.unsubscribes, 1);
});

test("a missing statistic stays null", () => {
  const rows = parseValuesReport(
    { data: { attributes: { results: [{ groupings: { flow_id: "F1" }, statistics: { opens: 2 } }] } } },
    "7d",
    ["flow_id"],
  );
  assert.equal(rows[0]?.revenuePence, null);
  assert.equal(rows[0]?.openRate, null);
  assert.equal(rows[0]?.clicks, null);
});

test("Placed Order is matched by name and list counts can be absent", () => {
  assert.equal(
    parsePlacedOrderMetric({ data: [{ id: "m1", attributes: { name: "Active on Site" } }, { id: "m2", attributes: { name: "Placed Order" } }] }),
    "m2",
  );
  const lists = parseLists({ data: [{ id: "L", attributes: { name: "Newsletter" } }] });
  assert.equal(lists[0]?.profiles, null);
  assert.equal(safeKlaviyoNext("https://a.klaviyo.com/api/flows?page[cursor]=abc"), "/api/flows?page[cursor]=abc");
  assert.equal(safeKlaviyoNext("https://evil.example/api/flows"), null);
});

test("Placed Order prefers the Shopify metric and campaign lists require a channel", () => {
  const metrics = parseMetricCatalog({
    data: [
      { id: "api", attributes: { name: "Placed Order", integration: { name: "API" } } },
      { id: "shop", attributes: { name: "Placed Order", integration: { name: "Shopify" } } },
      { id: "other", attributes: { name: "Active on Site", integration: { name: "Shopify" } } },
    ],
  });
  assert.equal(choosePlacedOrder(metrics), "shop");
  assert.equal(choosePlacedOrder([{ id: "only", name: "placed order", integration: "" }]), "only");
  assert.match(shopifyMetricsPath(), /integration\.name/);
  assert.match(decodeURIComponent(campaignNamePath("email")), /equals\(messages\.channel,'email'\)/);
  assert.match(decodeURIComponent(campaignNamePath("sms")), /messages\.channel,'sms'/);
  assert.equal(parseAccountCurrency({ data: [{ attributes: { preferred_currency: "GBP" } }] }), "GBP");
  assert.equal(parseAccountCurrency({ data: [{ attributes: { preferred_currency: "gbp" } }] }), null);
  assert.equal(retryWaitMs(null), 2_000);
  assert.equal(retryWaitMs("30"), 15_000);
  assert.equal(retryWaitMs("1"), 1_000);
});

test("a campaign values report sums messages and keeps Klaviyo's rates", () => {
  const rows = parseCampaignPerformance({
    data: {
      attributes: {
        results: [
          {
            groupings: { campaign_id: "01ABC", campaign_message_id: "M1", send_channel: "email" },
            statistics: {
              recipients: 100,
              delivered: 90,
              opens_unique: 50,
              open_rate: 0.5,
              clicks_unique: 5,
              click_rate: 0.05,
              conversion_value: 20.5,
              conversions: 2,
              conversion_rate: 0.02,
              unsubscribes: 1,
              bounced: 4,
              spam_complaints: 0,
            },
          },
          {
            groupings: { campaign_id: "01ABC", campaign_message_id: "M2", send_channel: "email" },
            statistics: {
              recipients: 50,
              delivered: 10,
              opens_unique: 10,
              open_rate: 1,
              clicks_unique: 0,
              click_rate: 0,
              conversion_value: 4.5,
              conversions: 1,
              conversion_rate: 0.1,
              unsubscribes: 0,
              bounced: 1,
              spam_complaints: 1,
            },
          },
        ],
      },
    },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.opens, 60);
  assert.equal(rows[0]?.clicks, 5);
  assert.equal(rows[0]?.delivered, 100);
  assert.equal(rows[0]?.orders, 3);
  assert.equal(rows[0]?.revenuePence, 2500);
  assert.equal(rows[0]?.openRate, (0.5 * 90 + 1 * 10) / 100);
  assert.equal(rows[0]?.aovPence, Math.round(2500 / 3));
  assert.equal(rows[0]?.bounces, 5);
  assert.equal(rows[0]?.spamComplaints, 1);
});

test("campaign messages point at the email template", () => {
  const message = parseCampaignMessage({
    data: [
      { id: "sms", attributes: { channel: "sms" }, relationships: {} },
      {
        id: "email",
        attributes: { channel: "email", content: { subject: "Friday bake" } },
        relationships: { template: { data: { type: "template", id: "Tmpl01" } } },
      },
    ],
  });
  assert.equal(message?.templateId, "Tmpl01");
  assert.equal(message?.subject, "Friday bake");
  assert.equal(parseTemplateHtml({ data: { attributes: { html: "<p>Hello</p>" } } }), "<p>Hello</p>");
  const flows = parseFlowList({ data: [{ id: "F1", attributes: { name: "Welcome", status: "live" } }] });
  assert.equal(flows[0]?.status, "live");
});
