import assert from "node:assert/strict";
import test from "node:test";
import { groupBySchedule, scheduleBadge, scheduleHeading } from "./schedule-groups.ts";

const sundayEvening = new Date("2026-10-25T23:30:00Z");
const mondayMorning = new Date("2026-10-26T00:30:00Z");

test("headings use Today, Tomorrow, then weekday and date", () => {
  assert.equal(scheduleHeading("2026-10-25", "2026-10-25"), "Today");
  assert.equal(scheduleHeading("2026-10-26", "2026-10-25"), "Tomorrow");
  assert.equal(scheduleHeading("2026-10-27", "2026-10-25"), "Tue 27 Oct");
  assert.equal(scheduleHeading("2026-10-26", "2026-10-24"), "Mon 26 Oct");
});

test("a story badge says Today, Tomorrow, or the day and month", () => {
  assert.equal(scheduleBadge("2026-10-25", sundayEvening), "Today");
  assert.equal(scheduleBadge("2026-10-26", sundayEvening), "Tomorrow");
  assert.equal(scheduleBadge("2026-10-27", sundayEvening), "27 Oct");
  assert.equal(scheduleBadge("2026-10-26", mondayMorning), "Today");
  assert.equal(scheduleBadge("2026-10-25", mondayMorning), "25 Oct");
});

test("groups are soonest first, with past collapsed last", () => {
  const groups = groupBySchedule(
    [
      { id: "later", plannedDate: "2026-10-28", plannedTime: "09:00", createdAt: "c" },
      { id: "tomorrow-late", plannedDate: "2026-10-26", plannedTime: "18:00", createdAt: "b" },
      { id: "tomorrow-early", plannedDate: "2026-10-26", plannedTime: "08:00", createdAt: "a" },
      { id: "today", plannedDate: "2026-10-25", plannedTime: null, createdAt: "d" },
      { id: "old", plannedDate: "2026-10-01", plannedTime: "12:00", createdAt: "e" },
      { id: "yesterday", plannedDate: "2026-10-24", plannedTime: "12:00", createdAt: "f" },
      { id: "untimed", plannedDate: "2026-10-26", plannedTime: "", createdAt: "g" },
    ],
    sundayEvening,
  );
  assert.deepEqual(
    groups.map((group) => ({
      heading: group.heading,
      past: group.past,
      ids: group.items.map((item) => item.id),
    })),
    [
      { heading: "Today", past: false, ids: ["today"] },
      { heading: "Tomorrow", past: false, ids: ["tomorrow-early", "tomorrow-late", "untimed"] },
      { heading: "Wed 28 Oct", past: false, ids: ["later"] },
      { heading: "Past", past: true, ids: ["old", "yesterday"] },
    ],
  );
});

test("London midnight moves yesterday into Past and today into Today", () => {
  const posts = [
    { id: "sun", plannedDate: "2026-10-25" },
    { id: "mon", plannedDate: "2026-10-26" },
    { id: "tue", plannedDate: "2026-10-27" },
  ];
  const before = groupBySchedule(posts, sundayEvening);
  const after = groupBySchedule(posts, mondayMorning);
  assert.deepEqual(
    before.map((group) => group.heading),
    ["Today", "Tomorrow", "Tue 27 Oct"],
  );
  assert.equal(before[0].items[0].id, "sun");
  assert.deepEqual(
    after.map((group) => [group.heading, group.past]),
    [
      ["Today", false],
      ["Tomorrow", false],
      ["Past", true],
    ],
  );
  assert.equal(after[0].items[0].id, "mon");
  assert.equal(after[2].items[0].id, "sun");
});
