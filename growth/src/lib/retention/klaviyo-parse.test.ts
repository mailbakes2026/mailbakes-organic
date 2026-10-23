import assert from "node:assert/strict";
import test from "node:test";
import { parseLists, parsePlacedOrderMetric, parseValuesReport, safeKlaviyoNext } from "./klaviyo-parse.ts";

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
