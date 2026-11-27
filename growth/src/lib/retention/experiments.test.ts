import assert from "node:assert/strict";
import test from "node:test";
import { experimentReady, readExperiment } from "./experiments.ts";

test("a new test needs a name and a split that leaves traffic on both sides", () => {
  const missing = readExperiment({}, "create");
  assert.equal(missing.ok, false);
  const draft = readExperiment({ name: "Subject line", status: "running", splitA: 50 }, "create");
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  assert.equal(draft.data.status, "running");
  assert.equal(draft.data.variantA, "");
  const wide = readExperiment({ name: "Subject line", splitA: 100 }, "create");
  assert.equal(wide.ok, false);
});

test("a picked winner has to name variant A or B", () => {
  const open = readExperiment({ name: "Welcome", status: "winner", winner: "" }, "create");
  assert.equal(open.ok, true);
  if (!open.ok) return;
  assert.equal(
    experimentReady({
      flowId: "",
      flowName: "Welcome",
      name: "Welcome",
      hypothesis: "",
      variantA: "Short",
      variantB: "Long",
      splitA: 50,
      status: open.data.status ?? "draft",
      winner: open.data.winner ?? "",
      metricName: "",
      metricA: "",
      metricB: "",
      lift: "",
      notes: "",
    }),
    "Pick variant A or variant B as the winner.",
  );
});
