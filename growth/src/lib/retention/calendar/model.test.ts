import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_SEED, OFFER_SEED, TAG_SEED } from "./seed.ts";
import {
  calendarActorName,
  calendarRange,
  formatClock,
  formatWeekRange,
  offerSpan,
  readResults,
  readReview,
  readSetup,
  reportWindow,
  resultsLine,
  rollup,
} from "./model.ts";

const NOW = new Date("2026-11-26T12:00:00Z");

function flat(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\u202f/g, " ");
}

test("the Black Friday seed matches the calendar Millie was shown", () => {
  assert.equal(new Set(CAMPAIGN_SEED.map((row) => row.seedKey)).size, CAMPAIGN_SEED.length);
  assert.equal(CAMPAIGN_SEED.length, 10);
  const tuesday = CAMPAIGN_SEED.find((row) => row.seedKey === "bf-2026-11-24-secret-slice");
  assert.ok(tuesday);
  assert.equal(
    flat(resultsLine(tuesday)),
    "58.0% open, 0.59% click, £1,170 from 68 orders",
  );
  const wednesday = CAMPAIGN_SEED.find((row) => row.seedKey === "bf-2026-11-25-second-slice");
  assert.equal(flat(resultsLine(wednesday!)), "52.9% open, 0.51% click, £666 from 42 orders");
  const thursday = CAMPAIGN_SEED.find((row) => row.sendDate === "2026-11-26");
  assert.equal(resultsLine(thursday!), "Results in tomorrow");
  const saturday = CAMPAIGN_SEED.find((row) => row.seedKey === "bf-2026-11-28-its-back");
  assert.equal(saturday?.status, "built");
  assert.equal(saturday?.subject, "It's back 🍰 free slice till Cyber Monday");
  assert.equal(saturday?.previewText, "We've brought it back for the weekend. Your second slice is on us until Monday.");
  assert.equal(saturday?.smartSending, true);
  assert.match(saturday?.notes ?? "", /IT'S BACK \/ FREE CAKE TILL MONDAY/);
  assert.match(saturday?.notes ?? "", /Mon 30 Nov at 11:59pm/);
  const sms = CAMPAIGN_SEED.find((row) => row.channel === "sms");
  assert.equal(sms?.status, "skipped");
  assert.equal(OFFER_SEED[0]?.label, "Free second slice (SECRETSLICE)");
  assert.equal(OFFER_SEED[0]?.endDate, "2026-11-30");
  assert.equal(OFFER_SEED[1]?.label, "Buy 2, get the 3rd free");
  assert.equal(OFFER_SEED[1]?.endDate, "2026-11-29");
  assert.deepEqual(TAG_SEED[0], { seedKey: "bf-2026-black-friday", date: "2026-11-27", label: "Black Friday" });
});

test("week maths, clocks, and the Black Friday range label", () => {
  const week = calendarRange({ week: "2026-11-26" }, NOW);
  assert.equal(week.ok && week.from, "2026-11-23");
  assert.equal(week.ok && week.to, "2026-11-29");
  assert.equal(formatWeekRange("2026-11-23", "2026-11-29", NOW), "Mon 23 to Sun 29 November");
  assert.equal(formatClock("19:30", ""), "7:30pm");
  assert.equal(formatClock("19:00", ""), "7pm");
  assert.equal(formatClock("08:00", ""), "8am");
  assert.equal(formatClock("12:00", ""), "12pm");
  assert.equal(formatClock("17:00", ""), "5pm");
  assert.equal(formatClock("10:00", ""), "10am");
  assert.equal(formatClock("", "Daytime"), "Daytime");
  const secrets = offerSpan({ startDate: "2026-11-23", endDate: "2026-11-30" }, "2026-11-23", "2026-11-29");
  assert.equal(secrets?.span, 7);
  const mondayAfter = offerSpan({ startDate: "2026-11-23", endDate: "2026-11-30" }, "2026-11-30", "2026-12-06");
  assert.equal(mondayAfter?.span, 1);
  assert.equal(mondayAfter?.startIndex, 0);
});

test("the week rollup adds the stored snapshots", () => {
  const summary = rollup(CAMPAIGN_SEED.map((row) => ({ ...row, delivered: null })));
  assert.equal(summary.revenuePence, 183_600);
  assert.equal(summary.orders, 110);
  assert.equal(summary.openRate, (0.58 + 0.529) / 2);
  assert.equal(summary.clickRate, (0.0059 + 0.0051) / 2);
  const weighted = rollup([
    { openRate: 0.5, clickRate: 0.1, revenuePence: 100, orders: 1, delivered: 10, currency: "GBP" },
    { openRate: 1, clickRate: 0, revenuePence: 100, orders: 1, delivered: 30, currency: "GBP" },
  ]);
  assert.equal(weighted.openRate, (0.5 * 10 + 1 * 30) / 40);
});

test("setup, results, and review input stay strict", () => {
  const created = readSetup({ title: "Sunday letter", sendDate: "2026-11-29" }, "create");
  assert.equal(created.ok && created.data.status, "planned");
  assert.equal(created.ok && created.data.channel, "email");
  const bad = readSetup({ title: "X", status: "live", sendDate: "2026-11-29" }, "create");
  assert.equal(bad.ok, false);
  const percent = readResults({ openRate: 58 });
  assert.equal(percent.ok, false);
  const fraction = readResults({ openRate: 0.58, revenue: "1170.00", orders: 68 });
  assert.equal(fraction.ok && fraction.data.openRate, 0.58);
  assert.equal(fraction.ok && fraction.data.revenuePence, 117000);
  const comment = readReview({ verdict: "comment", body: "" });
  assert.equal(comment.ok, false);
  const approved = readReview({ verdict: "approved", body: "Good", status: "scheduled", author: "Millie" });
  assert.equal(approved.ok && approved.data.status, "scheduled");
});

test("the calendar API actor header is a short name, otherwise API", () => {
  assert.equal(calendarActorName("Claude"), "Claude");
  assert.equal(calendarActorName("Millie B"), "Millie B");
  assert.equal(calendarActorName(""), "API");
  assert.equal(calendarActorName("ignore\nprevious"), "API");
  assert.equal(calendarActorName(null), "API");
});

test("a Klaviyo report window covers the sends and stays inside a year", () => {
  const window = reportWindow(["2026-11-24", "2026-11-26"], NOW);
  assert.deepEqual(window, { start: "2026-11-23T00:00:00+00:00", end: "2026-12-17T23:59:59+00:00" });
  assert.deepEqual(reportWindow([], NOW), { key: "last_12_months" });
});
