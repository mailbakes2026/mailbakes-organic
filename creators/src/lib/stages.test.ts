import assert from "node:assert/strict";
import test from "node:test";
import { stageFromSheetStatus } from "./stages.ts";

test("sample sheet statuses land on the pipeline", () => {
  assert.deepEqual(stageFromSheetStatus("Approved"), { stage: "approved", rush: false });
  assert.deepEqual(stageFromSheetStatus("Hold"), { stage: "on_hold", rush: false });
  assert.deepEqual(stageFromSheetStatus("Waiting"), { stage: "message_needed", rush: false });
  assert.deepEqual(stageFromSheetStatus("Need approve"), { stage: "inquiry", rush: false });
  assert.deepEqual(stageFromSheetStatus("Need approve (rush)"), { stage: "inquiry", rush: true });
});

test("an unknown status is not guessed", () => {
  assert.equal(stageFromSheetStatus("Shipped"), null);
  assert.equal(stageFromSheetStatus(""), null);
});
