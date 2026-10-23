import assert from "node:assert/strict";
import test from "node:test";
import { assessMetaChange } from "./changes.ts";

test("Meta allows one budget change on a London day", () => {
  const existing = [{ id: "a", day: "2026-10-23" }];
  assert.equal(assessMetaChange(existing, "2026-10-23", null).ok, false);
  assert.equal(assessMetaChange(existing, "2026-10-24", null).ok, true);
});

test("today's row can be edited and yesterday's cannot", () => {
  const existing = [{ id: "a", day: "2026-10-22" }];
  assert.equal(assessMetaChange(existing, "2026-10-23", "a").ok, false);
  assert.equal(assessMetaChange([{ id: "a", day: "2026-10-23" }], "2026-10-23", "a").ok, true);
});
