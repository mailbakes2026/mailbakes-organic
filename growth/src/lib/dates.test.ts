import assert from "node:assert/strict";
import test from "node:test";
import { addDays, daysBetween, eachDate, mondayOf, monthGrid, parseDateOnly } from "./dates.ts";

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

test("a month grid starts on Monday and ends on Sunday", () => {
  const grid = monthGrid("2026-11");
  assert.equal(grid?.start, "2026-11-01");
  assert.equal(grid?.end, "2026-11-30");
  assert.equal(grid?.from, "2026-10-26");
  assert.equal(grid?.to, "2026-12-06");
  assert.equal(daysBetween("2026-01-01", "2026-01-31"), 30);
  assert.equal(monthGrid("2026-13"), null);
});
