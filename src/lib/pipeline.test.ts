import assert from "node:assert/strict";
import test from "node:test";
import {
  approverMayAct,
  awaitingApproval,
  columnFor,
  migratedStatus,
  onBoard,
  statusAfterSave,
} from "./pipeline.ts";

const changesRound = [
  { kind: "CHANGES", body: "Is this a series? Is there a couple here?" },
  { kind: "NOTE", body: "Sent back for approval." },
];

test("a post sent back after changes lands in Amendments made", () => {
  const status = migratedStatus("PENDING_APPROVAL", changesRound);
  assert.equal(status, "AMENDMENTS_MADE");
  assert.equal(columnFor(status), "amended");
  assert.equal(awaitingApproval(status), true);
});

test("a first submission stays in For approval", () => {
  assert.equal(migratedStatus("PENDING_APPROVAL", []), "PENDING_APPROVAL");
  assert.equal(columnFor("PENDING_APPROVAL"), "approval");
  assert.equal(columnFor("DRAFT"), "approval");
  assert.equal(columnFor("CHANGES_REQUESTED"), "changes");
  assert.equal(columnFor("APPROVED"), "approved");
  assert.equal(columnFor("REJECTED"), null);
});

test("the approver can act again after a changes round", () => {
  const status = migratedStatus("PENDING_APPROVAL", changesRound);
  assert.equal(approverMayAct("MANAGEMENT", status, "approve"), true);
  assert.equal(approverMayAct("MANAGEMENT", status, "request_changes"), true);
  assert.equal(approverMayAct("MANAGEMENT", "PENDING_APPROVAL", "approve"), true);
  assert.equal(approverMayAct("MANAGEMENT", "PENDING_APPROVAL", "request_changes"), true);
  assert.equal(approverMayAct("TEAM", status, "approve"), false);
  assert.equal(approverMayAct("TEAM", "PENDING_APPROVAL", "request_changes"), false);
});

test("saving an amended post puts it back in the approval flow", () => {
  assert.equal(statusAfterSave("TEAM", "PENDING_APPROVAL", "CHANGES_REQUESTED"), "AMENDMENTS_MADE");
  assert.equal(statusAfterSave("TEAM", "CHANGES_REQUESTED", "CHANGES_REQUESTED"), "AMENDMENTS_MADE");
  assert.equal(statusAfterSave("TEAM", "PENDING_APPROVAL", "APPROVED"), "AMENDMENTS_MADE");
  assert.equal(statusAfterSave("TEAM", "DRAFT", "CHANGES_REQUESTED"), "DRAFT");
  assert.equal(statusAfterSave("TEAM", "PENDING_APPROVAL"), "PENDING_APPROVAL");
  assert.equal(statusAfterSave("TEAM", "APPROVED"), null);
  assert.equal(statusAfterSave("MANAGEMENT", "APPROVED", "AMENDMENTS_MADE"), "APPROVED");
});

test("boards keep stories, TikTok and Meta posts apart", () => {
  const story = { platforms: ["INSTAGRAM" as const], contentType: "STORY" as const };
  const feed = { platforms: ["INSTAGRAM" as const, "FACEBOOK" as const], contentType: "FEED" as const };
  const tiktok = { platforms: ["TIKTOK" as const], contentType: "REEL" as const };
  const both = { platforms: ["INSTAGRAM" as const, "TIKTOK" as const], contentType: "REEL" as const };
  const linkedin = { platforms: ["LINKEDIN" as const], contentType: "FEED" as const };
  assert.equal(onBoard(story, "meta-stories"), true);
  assert.equal(onBoard(story, "meta-posts"), false);
  assert.equal(onBoard(feed, "meta-posts"), true);
  assert.equal(onBoard(tiktok, "tiktok"), true);
  assert.equal(onBoard(tiktok, "meta-posts"), false);
  assert.equal(onBoard(both, "meta-posts"), true);
  assert.equal(onBoard(both, "tiktok"), true);
  assert.equal(onBoard(linkedin, "meta-posts"), true);
});
