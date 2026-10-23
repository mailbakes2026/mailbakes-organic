import assert from "node:assert/strict";
import test from "node:test";
import { buildSeed } from "./seed-build.ts";
import type { CreatorFields } from "./types.ts";
import { applyUpdate } from "./update.ts";

function fields(name: string, extra: Partial<CreatorFields> = {}): CreatorFields {
  const seed = buildSeed().find((row) => row.name === name);
  if (!seed) throw new Error(name);
  return {
    name: seed.name,
    handle: seed.handle,
    email: seed.email,
    shopifyOrder: seed.shopifyOrder,
    stage: seed.stage,
    rush: seed.rush,
    cardMessage: seed.cardMessage,
    notes: seed.notes,
    shipDate: null,
    courier: "",
    trackingNumber: "",
    declineReason: "",
    posted: false,
    postUrl: "",
    views: null,
    orders: null,
    rating: null,
    worksWell: false,
    ...extra,
  };
}

test("accept moves an inquiry to Approved and decline keeps the reason", () => {
  const louis = fields("Louis");
  const accepted = applyUpdate(louis, { via: "accept" });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.equal(accepted.next.stage, "approved");
  assert.equal(accepted.next.rush, true);
  assert.match(accepted.detail, /^Accepted into the pipeline\./);

  const declined = applyUpdate(louis, { via: "decline", declineReason: "Not a fit" });
  assert.equal(declined.ok, true);
  if (!declined.ok) return;
  assert.equal(declined.next.stage, "declined");
  assert.equal(declined.detail, "Declined. Not a fit");
  assert.equal(applyUpdate(fields("Katharine Cruse"), { via: "accept" }).ok, false);
});

test("moving to Shipped sets today's London date when none was entered", () => {
  const now = new Date("2026-10-23T15:00:00.000Z");
  const result = applyUpdate(fields("Katharine Cruse"), { stage: "shipped" }, now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.next.shipDate, "2026-10-23");
  assert.match(result.detail, /Moved from Approved to Shipped/);
  assert.match(result.detail, /23 Oct 2026/);
});

test("moving to Posted marks the creator as posted", () => {
  const result = applyUpdate(fields("Eva Wright"), { stage: "posted" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.next.posted, true);
  assert.match(result.detail, /Marked as posted/);
});

test("an unchanged save does not invent a history line", () => {
  const eva = fields("Eva Wright");
  const result = applyUpdate(eva, { notes: eva.notes });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.detail, "Saved.");
});
