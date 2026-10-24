import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  bearerMatches,
  organicSummaryResult,
  organicTokenFromEnv,
  summariseOrganic,
} from "./organic-summary.ts";

const posts = [
  { status: "PENDING_APPROVAL", plannedDate: "2026-10-24" },
  { status: "CHANGES_REQUESTED", plannedDate: "2026-11-01" },
  { status: "AMENDMENTS_MADE", plannedDate: "2026-10-20" },
  { status: "APPROVED", plannedDate: "2026-10-19" },
  { status: "APPROVED", plannedDate: "2026-10-25" },
  { status: "APPROVED", plannedDate: "2026-10-18" },
  { status: "APPROVED", plannedDate: "2026-10-26" },
  { status: "DRAFT", plannedDate: "2026-10-30" },
  { status: "REJECTED", plannedDate: "2026-10-24" },
  { status: "PENDING_APPROVAL", plannedDate: "2026-10-31" },
];

test("Saturday in London counts this Mon-Sun week and the next seven days", () => {
  const summary = summariseOrganic(posts, new Date("2026-10-24T11:00:00Z"));
  assert.deepEqual(summary, {
    awaiting_approval: 4,
    approved_this_week: 2,
    scheduled_next_7_days: 4,
  });
});

test("the week flips on Monday morning in London", () => {
  const sunday = summariseOrganic(
    [{ status: "APPROVED", plannedDate: "2026-10-25" }],
    new Date("2026-10-25T23:30:00Z"),
  );
  const monday = summariseOrganic(
    [
      { status: "APPROVED", plannedDate: "2026-10-25" },
      { status: "APPROVED", plannedDate: "2026-10-26" },
    ],
    new Date("2026-10-26T00:30:00Z"),
  );
  assert.equal(sunday.approved_this_week, 1);
  assert.equal(monday.approved_this_week, 1);
  assert.equal(monday.scheduled_next_7_days, 1);
});

test("a declined post is left out of the next seven days", () => {
  const summary = summariseOrganic(
    [{ status: "REJECTED", plannedDate: "2026-10-24" }],
    new Date("2026-10-24T11:00:00Z"),
  );
  assert.equal(summary.scheduled_next_7_days, 0);
  assert.equal(summary.awaiting_approval, 0);
  assert.equal(summary.approved_this_week, 0);
});

test("ORGANIC_API_TOKEN is read from the env object and must match the bearer", () => {
  assert.equal(organicTokenFromEnv({ ORGANIC_API_TOKEN: " runtime-token " }), "runtime-token");
  assert.equal(organicTokenFromEnv({}), "");
  assert.equal(bearerMatches(null, "runtime-token"), false);
  assert.equal(bearerMatches("Bearer wrong-token", "runtime-token"), false);
  assert.equal(bearerMatches("bearer runtime-token", "runtime-token"), true);
  assert.equal(bearerMatches("Bearer runtime-token", ""), false);
  const source = readFileSync(new URL("./organic-summary.ts", import.meta.url), "utf8");
  assert.match(source, /env\["ORGANIC_API_TOKEN"\]/);
  assert.doesNotMatch(source, /ORGANIC_API_TOKEN\s*=\s*["'`]/);
});

test("a database failure is 503 and does not invent counts", async () => {
  const result = await organicSummaryResult(async () => {
    throw new Error("connect ECONNREFUSED");
  }, new Date("2026-10-24T11:00:00Z"));
  assert.equal(result.status, 503);
  assert.equal("awaiting_approval" in result.body, false);
});

test("the summary route is outside the session cookie gate", () => {
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  const gate = middleware.indexOf('request.cookies.get("mb_session")');
  const exempt = middleware.indexOf('pathname.startsWith("/api/v1/")');
  assert.ok(exempt >= 0 && gate > exempt);
});
