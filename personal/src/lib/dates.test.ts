import assert from "node:assert/strict";
import test from "node:test";
import { addDays, londonDateTime, londonParts, londonWeekCommencing, parseDateOnly, snoozePreset } from "./dates.ts";

test("rejects a calendar day that does not exist", () => {
  assert.equal(parseDateOnly("2026-02-31"), null);
  assert.equal(parseDateOnly("21-10-2026"), null);
});

test("adds days across a month end", () => {
  assert.equal(addDays("2026-01-30", 3), "2026-02-02");
});

test("08:00 London is GMT in January and BST in July", () => {
  assert.equal(londonDateTime("2026-01-16", 8).toISOString(), "2026-01-16T08:00:00.000Z");
  assert.equal(londonDateTime("2026-07-16", 8).toISOString(), "2026-07-16T07:00:00.000Z");
});

test("tomorrow snooze is 08:00 London the next day", () => {
  const winter = snoozePreset("tomorrow", new Date("2026-01-15T18:30:00Z"));
  assert.equal(winter?.toISOString(), "2026-01-16T08:00:00.000Z");
  const summer = snoozePreset("tomorrow", new Date("2026-07-15T18:30:00Z"));
  assert.equal(summer?.toISOString(), "2026-07-16T07:00:00.000Z");
  const parts = londonParts(summer!);
  assert.equal(parts.hour, 8);
  assert.equal(parts.day, 16);
});

test("a Wednesday belongs to the Monday of that week", () => {
  assert.equal(londonWeekCommencing(new Date("2026-10-21T12:00:00Z")), "2026-10-19");
});

test("a Sunday belongs to the Monday before", () => {
  assert.equal(londonWeekCommencing(new Date("2026-10-18T12:00:00Z")), "2026-10-12");
});

test("later snooze is three hours on", () => {
  const now = new Date("2026-04-01T09:00:00Z");
  assert.equal(snoozePreset("later", now)?.toISOString(), "2026-04-01T12:00:00.000Z");
});
