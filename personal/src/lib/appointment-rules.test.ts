import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AppointmentError,
  cleanAppointment,
  cleanTime,
  dueReminders,
  mondayOf,
  parseReminder,
  parseType,
  remindersNeedReset,
  startInstant,
} from "./appointment-rules.ts";

test("a timed appointment with no end is one hour", () => {
  const clean = cleanAppointment({ title: "Hair, Megan", type: "hair", startDay: "2026-11-14", startTime: "11:00" });
  assert.equal(clean.type, "Hair");
  assert.equal(clean.endDay, "2026-11-14");
  assert.equal(clean.endTime, "12:00");
  assert.equal(clean.reminder, "none");
});

test("one hour is capped at the end of the day", () => {
  const clean = cleanAppointment({ title: "Late", startDay: "2026-11-14", startTime: "23:30" });
  assert.equal(clean.endTime, "23:59");
});

test("a multi-day all-day trip keeps its end date", () => {
  const clean = cleanAppointment({ title: "Carlton, Cannes", type: "Travel", startDay: "2026-11-07", endDay: "2026-11-12", allDay: true });
  assert.equal(clean.endDay, "2026-11-12");
  assert.equal(clean.startTime, "");
});

test("bad input is refused with a clear message", () => {
  assert.throws(() => cleanAppointment({ startDay: "2026-11-14", startTime: "11:00" }), /Add a title/);
  assert.throws(() => cleanAppointment({ title: "x", startDay: "14/11/2026", startTime: "11:00" }), /YYYY-MM-DD/);
  assert.throws(() => cleanAppointment({ title: "x", startDay: "2026-02-30", startTime: "11:00" }), /YYYY-MM-DD/);
  assert.throws(() => cleanAppointment({ title: "x", startDay: "2026-11-14" }), /start time/);
  assert.throws(() => cleanAppointment({ title: "x", startDay: "2026-11-14", startTime: "11:00", endTime: "10:00" }), /after the start/);
  assert.throws(
    () => cleanAppointment({ title: "x", startDay: "2026-11-14", endDay: "2026-11-13", allDay: true }),
    /before the start/,
  );
  assert.throws(
    () => cleanAppointment({ title: "x", startDay: "2026-11-14", endDay: "2026-11-15", startTime: "10:00" }),
    /Only all-day/,
  );
  assert.throws(
    () => cleanAppointment({ title: "x", startDay: "2026-01-01", endDay: "2027-01-01", allDay: true }),
    /at most/,
  );
  assert.throws(() => parseType("Gym"), AppointmentError);
  assert.throws(() => parseReminder("weekly"), AppointmentError);
});

test("times are tidied", () => {
  assert.equal(cleanTime("9:05", "start"), "09:05");
  assert.throws(() => cleanTime("25:00", "start"), /14:30/);
  assert.throws(() => cleanTime("9.30", "start"), /14:30/);
});

test("reminder names are forgiving", () => {
  assert.equal(parseReminder("Day before"), "day-before");
  assert.equal(parseReminder("day_before"), "day-before");
  assert.equal(parseReminder("BOTH"), "both");
});

test("an update only changes what was sent", () => {
  const base = cleanAppointment({ title: "Hair, Megan", type: "Hair", startDay: "2026-11-14", startTime: "11:00", endTime: "12:30", location: "Salon" });
  const moved = cleanAppointment({ startTime: "14:00" }, base);
  assert.equal(moved.title, "Hair, Megan");
  assert.equal(moved.location, "Salon");
  assert.equal(moved.startTime, "14:00");
  assert.equal(moved.endTime, "15:30", "keeps the 90-minute length");
  const retitled = cleanAppointment({ title: "Hair, Lyla" }, base);
  assert.equal(retitled.endTime, "12:30");
});

test("moving a trip keeps its length; turning it into a timed one needs a time", () => {
  const trip = cleanAppointment({ title: "Cannes", startDay: "2026-11-07", endDay: "2026-11-12", allDay: true });
  const later = cleanAppointment({ startDay: "2026-11-14" }, trip);
  assert.equal(later.endDay, "2026-11-19");
  assert.throws(() => cleanAppointment({ allDay: false }, trip), /start time/);
  const timed = cleanAppointment({ allDay: false, startTime: "10:00" }, trip);
  assert.equal(timed.endDay, timed.startDay);
});

test("reminders reset when the date, time or reminder changes", () => {
  const base = cleanAppointment({ title: "x", startDay: "2026-11-14", startTime: "11:00", reminder: "both" });
  assert.equal(remindersNeedReset(base, cleanAppointment({ notes: "bring photos" }, base)), false);
  assert.equal(remindersNeedReset(base, cleanAppointment({ startTime: "12:00" }, base)), true);
  assert.equal(remindersNeedReset(base, cleanAppointment({ startDay: "2026-11-15" }, base)), true);
  assert.equal(remindersNeedReset(base, cleanAppointment({ reminder: "morning" }, base)), true);
});

// 14 Nov 2026 is GMT, so London time equals UTC.
const hair = { startDay: "2026-11-14", allDay: false, startTime: "11:00", reminder: "both" as const, morningSentAt: null, dayBeforeSentAt: null };

test("day-before reminder: 6pm to midnight the day before only", () => {
  assert.deepEqual(dueReminders(hair, new Date("2026-11-13T17:59:00Z")), []);
  assert.deepEqual(dueReminders(hair, new Date("2026-11-13T18:00:00Z")), ["day-before"]);
  assert.deepEqual(dueReminders(hair, new Date("2026-11-13T23:45:00Z")), ["day-before"]);
  assert.deepEqual(dueReminders(hair, new Date("2026-11-12T19:00:00Z")), []);
  assert.deepEqual(dueReminders({ ...hair, dayBeforeSentAt: new Date() }, new Date("2026-11-13T19:00:00Z")), []);
});

test("morning reminder: from 7am until it starts, on the day", () => {
  assert.deepEqual(dueReminders(hair, new Date("2026-11-14T06:59:00Z")), []);
  assert.deepEqual(dueReminders(hair, new Date("2026-11-14T07:00:00Z")), ["morning"]);
  assert.deepEqual(dueReminders(hair, new Date("2026-11-14T10:59:00Z")), ["morning"]);
  assert.deepEqual(dueReminders(hair, new Date("2026-11-14T11:00:00Z")), [], "too late once it has started");
  assert.deepEqual(dueReminders({ ...hair, reminder: "day-before" }, new Date("2026-11-14T08:00:00Z")), []);
  assert.deepEqual(dueReminders({ ...hair, reminder: "none" }, new Date("2026-11-13T19:00:00Z")), []);
});

test("an early appointment gets no morning reminder after it starts", () => {
  const early = { ...hair, startTime: "06:30" };
  assert.deepEqual(dueReminders(early, new Date("2026-11-14T07:00:00Z")), []);
});

test("all-day morning reminders run 7am to noon", () => {
  const day = { ...hair, allDay: true, startTime: "" };
  assert.deepEqual(dueReminders(day, new Date("2026-11-14T11:59:00Z")), ["morning"]);
  assert.deepEqual(dueReminders(day, new Date("2026-11-14T12:00:00Z")), []);
});

test("reminders follow London summer time", () => {
  // 15 Oct 2026 is BST (UTC+1): 07:00 London is 06:00 UTC.
  const summer = { ...hair, startDay: "2026-10-15" };
  assert.deepEqual(dueReminders(summer, new Date("2026-10-15T05:59:00Z")), []);
  assert.deepEqual(dueReminders(summer, new Date("2026-10-15T06:00:00Z")), ["morning"]);
  assert.equal(startInstant(summer).toISOString(), "2026-10-15T10:00:00.000Z");
});

test("week starts on Monday", () => {
  assert.equal(mondayOf("2026-10-26"), "2026-10-26");
  assert.equal(mondayOf("2026-11-01"), "2026-10-26");
  assert.equal(mondayOf("2026-11-02"), "2026-11-02");
});
