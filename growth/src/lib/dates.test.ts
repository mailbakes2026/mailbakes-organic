import assert from "node:assert/strict";
import test from "node:test";
import { addDays, eachDate, mondayOf, parseDateOnly } from "./dates.ts";

test("rejects a calendar day that does not exist", () => {
  assert.equal(parseDateOnly("2026-02-31"), null);
});

test("Monday of a Friday is that week's Monday", () => {
  assert.equal(mondayOf("2026-10-23"), "2026-10-19");
});

test("eachDate is inclusive and empty when reversed", () => {
  assert.deepEqual(eachDate("2026-10-21", "2026-10-23"), ["2026-10-21", "2026-10-22", "2026-10-23"]);
  assert.deepEqual(eachDate("2026-10-23", "2026-10-21"), []);
});

test("addDays crosses a month", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
});
