import assert from "node:assert/strict";
import test from "node:test";
import { buildSeed } from "./seed-build.ts";
import { awaitingMessage, leaderboard, rushItems, shippedThisWeek, stageCounts } from "./stats.ts";

const now = new Date("2026-10-23T12:00:00.000Z");

test("the eight sample orders count up by stage", () => {
  const rows = buildSeed().map((row) => ({ stage: row.stage, rush: row.rush, shipDate: null }));
  const counts = stageCounts(rows);
  assert.equal(counts.inquiry, 3);
  assert.equal(counts.approved, 3);
  assert.equal(counts.message_needed, 1);
  assert.equal(counts.on_hold, 1);
  assert.equal(counts.ready_to_ship, 0);
  assert.equal(counts.shipped, 0);
  assert.equal(counts.delivered, 0);
  assert.equal(counts.posted, 0);
  assert.equal(counts.declined, 0);
  assert.equal(awaitingMessage(rows), 1);
  assert.equal(rushItems(rows), 1);
  assert.equal(shippedThisWeek(rows, now), 0);
});

test("shipped this week uses the London Monday and ignores a date with no dispatch", () => {
  const rows = [
    { stage: "shipped" as const, rush: false, shipDate: "2026-10-19" },
    { stage: "posted" as const, rush: false, shipDate: "2026-10-25" },
    { stage: "shipped" as const, rush: false, shipDate: "2026-10-18" },
    { stage: "approved" as const, rush: false, shipDate: "2026-10-23" },
    { stage: "delivered" as const, rush: false, shipDate: "2026-10-26" },
  ];
  assert.equal(shippedThisWeek(rows, now), 2);
});

test("a declined rush is not still a rush item", () => {
  assert.equal(rushItems([{ stage: "declined", rush: true, shipDate: null }]), 0);
});

test("works well ranks above an unflagged rating, and blanks stay last", () => {
  const ranked = leaderboard([
    { name: "B", worksWell: false, rating: 5, orders: 3, views: 9 },
    { name: "A", worksWell: true, rating: 1, orders: null, views: null },
    { name: "C", worksWell: false, rating: null, orders: 0, views: 4 },
  ]);
  assert.deepEqual(
    ranked.map((row) => row.name),
    ["A", "B", "C"],
  );
});
