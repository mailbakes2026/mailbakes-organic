import assert from "node:assert/strict";
import test from "node:test";
import { addDays, formatLondon, londonToday, londonWeekStart, parseDateOnly } from "./dates.ts";

test("rejects a calendar day that does not exist", () => {
  assert.equal(parseDateOnly("2026-02-31"), null);
  assert.equal(parseDateOnly("21-10-2026"), null);
});

test("adds days across a month end", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
});

test("London week starts on Monday", () => {
  const friday = new Date("2026-10-23T12:00:00.000Z");
  assert.equal(londonToday(friday), "2026-10-23");
  assert.equal(londonWeekStart(friday), "2026-10-19");
  assert.equal(londonWeekStart(new Date("2026-10-18T23:30:00.000Z")), "2026-10-19");
  assert.equal(londonWeekStart(new Date("2026-10-18T22:30:00.000Z")), "2026-10-12");
});

test("seed instant is 09:00 in London", () => {
  assert.equal(formatLondon(new Date("2026-10-23T08:00:00.000Z")), "23 Oct 2026, 09:00");
});
