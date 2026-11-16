import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanDay,
  cleanDebrief,
  cleanItemText,
  conversionDebrief,
  financeDebrief,
  operationsDebrief,
  organicDebrief,
  shouldCarry,
} from "./diary-rules.ts";

test("checklist text is tidied and checked", () => {
  assert.equal(cleanItemText("  Book   trains "), "Book trains");
  assert.throws(() => cleanItemText("   "), /Write something/);
  assert.throws(() => cleanItemText("x".repeat(301)), /300/);
});

test("days must be real dates", () => {
  assert.equal(cleanDay("2026-10-27"), "2026-10-27");
  assert.throws(() => cleanDay("2026-02-30"), /real date/);
  assert.throws(() => cleanDay("27/10/2026"), /YYYY-MM-DD/);
});

test("unticked items from earlier days carry; ticked and today's stay", () => {
  assert.equal(shouldCarry({ day: "2026-10-26", done: false }, "2026-10-27"), true);
  assert.equal(shouldCarry({ day: "2026-10-26", done: true }, "2026-10-27"), false);
  assert.equal(shouldCarry({ day: "2026-10-27", done: false }, "2026-10-27"), false);
  assert.equal(shouldCarry({ day: "2026-10-28", done: false }, "2026-10-27"), false);
});

test("a pushed debrief is checked and defaults to today", () => {
  const d = cleanDebrief({ source: "Operations", title: "Jess's end of day", lines: ["700 orders out on time", "", "Needs 4 bags of flour tomorrow"] }, "2026-10-27");
  assert.equal(d.source, "operations");
  assert.equal(d.day, "2026-10-27");
  assert.equal(d.kind, "daily");
  assert.deepEqual(d.lines, ["700 orders out on time", "Needs 4 bags of flour tomorrow"]);
  assert.throws(() => cleanDebrief({ source: "mikey", title: "x", lines: [] }, "2026-10-27"), /source must be/);
  assert.throws(() => cleanDebrief({ source: "orders", lines: [] }, "2026-10-27"), /title/);
  assert.throws(() => cleanDebrief({ source: "orders", title: "x", lines: "nope" }, "2026-10-27"), /lines/);
  assert.throws(() => cleanDebrief({ source: "orders", title: "x", lines: [], link: "javascript:alert(1)" }, "2026-10-27"), /web address/);
});

test("finance summary becomes plain sentences", () => {
  const d = financeDebrief({ week: { revenue: 41234.4, gross_margin_pct: 52.6, net_profit: 9100 }, month: { revenue: null } }, "2026-10-27");
  assert.deepEqual(d?.lines, ["Last full week: revenue £41,234, gross margin 53%, net profit £9,100."]);
  assert.equal(financeDebrief({}, "2026-10-27"), null);
});

test("operations summary", () => {
  const d = operationsDebrief({ production_today: 1200, stock_items_low: 3, waste: 14 }, "2026-10-27");
  assert.deepEqual(d?.lines, ["1,200 cakes made today.", "3 stock items below reorder level.", "14 items of waste logged."]);
  const quiet = operationsDebrief({ production_today: 0, stock_items_low: 0, waste: 0 }, "2026-10-27");
  assert.deepEqual(quiet?.lines, ["No production logged yet today.", "No stock below reorder level."]);
});

test("organic summary", () => {
  const d = organicDebrief({ awaiting_approval: 2, approved_this_week: 5, scheduled_next_7_days: 9 }, "2026-10-27");
  assert.deepEqual(d?.lines, ["2 posts waiting for your approval.", "9 posts planned for the next 7 days.", "5 posts approved this week."]);
});

test("conversion summary", () => {
  const d = conversionDebrief({
    running: { name: "Free card message", day: 4, total_days: 7, lift_pct: 13.9, confidence_pct: 81, verdict: "Too early to call. Keep it running" },
    last_finished: { name: "Hero button", winner: "A", lift_pct: -8.7 },
    ideas: 6,
    next: 1,
  }, "2026-10-27");
  assert.deepEqual(d?.lines, [
    "Running: Free card message. Day 4 of 7, B +13.9%, 81% sure.",
    "Too early to call. Keep it running.",
    "Last result: Hero button, kept A (B -8.7%).",
    "6 ideas waiting, 1 lined up next.",
  ]);
  assert.deepEqual(conversionDebrief({ running: null, ideas: 0 }, "2026-10-27")?.lines, ["No test running. Start the next one.", "0 ideas waiting."]);
});
