import assert from "node:assert/strict";
import test from "node:test";
import { revenueLabel } from "./format.ts";

test("a blank Klaviyo currency is shown as GBP", () => {
  const label = revenueLabel([
    { revenuePence: 1550, currency: "" },
    { revenuePence: 450, currency: "" },
  ]);
  assert.equal(label, "£20.00");
});

test("two real currencies stay mixed", () => {
  assert.equal(
    revenueLabel([
      { revenuePence: 100, currency: "GBP" },
      { revenuePence: 100, currency: "USD" },
    ]),
    "Mixed currencies",
  );
});

test("no revenue stays blank", () => {
  assert.equal(revenueLabel([{ revenuePence: null, currency: "GBP" }]), null);
});
