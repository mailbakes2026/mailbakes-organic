import { formatDay, londonToday } from "./dates.ts";
import { stageLabel } from "./stages.ts";
import type { CreatorPatch } from "./parse.ts";
import type { CreatorFields } from "./types.ts";

function oxford(items: string[]) {
  if (items.length === 1) return `the ${items[0]}`;
  if (items.length === 2) return `the ${items[0]} and ${items[1]}`;
  return `the ${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function countPhrase(label: string, value: number | null) {
  if (value === null) return `${label} cleared.`;
  return `${label} set to ${value.toLocaleString("en-GB")}.`;
}

export function describeChanges(before: CreatorFields, after: CreatorFields, via?: "accept" | "decline") {
  const bits: string[] = [];
  if (before.stage !== after.stage) {
    if (via === "accept") bits.push("Accepted into the pipeline.");
    else if (via === "decline") bits.push(after.declineReason ? `Declined. ${after.declineReason}` : "Declined.");
    else bits.push(`Moved from ${stageLabel(before.stage)} to ${stageLabel(after.stage)}.`);
  }

  if (before.shipDate !== after.shipDate) {
    bits.push(after.shipDate ? `Ship date set to ${formatDay(after.shipDate)}.` : "Ship date cleared.");
  }
  if (before.rush !== after.rush) bits.push(after.rush ? "Marked as rush." : "Cleared the rush flag.");
  if (before.posted !== after.posted) bits.push(after.posted ? "Marked as posted." : "Cleared the posted flag.");
  if (before.worksWell !== after.worksWell) bits.push(after.worksWell ? "Marked as works well." : "Cleared the works well flag.");
  if (before.rating !== after.rating) bits.push(after.rating ? `Rating set to ${after.rating}.` : "Rating cleared.");
  if (before.views !== after.views) bits.push(countPhrase("Views", after.views));
  if (before.orders !== after.orders) bits.push(countPhrase("Orders", after.orders));

  const edited: string[] = [];
  const textFields: [keyof CreatorFields, string][] = [
    ["name", "name"],
    ["handle", "TikTok handle"],
    ["email", "email"],
    ["shopifyOrder", "Shopify order"],
    ["cardMessage", "card message"],
    ["notes", "notes"],
    ["courier", "courier"],
    ["trackingNumber", "tracking number"],
    ["postUrl", "post link"],
    ["tiktokOrderId", "TikTok order ID"],
    ["tiktokMessage", "order message"],
  ];
  for (const [key, label] of textFields) {
    if (before[key] !== after[key]) edited.push(label);
  }
  if (via !== "decline" && before.declineReason !== after.declineReason) edited.push("decline reason");
  if (edited.length) bits.push(`Updated ${oxford(edited)}.`);

  if (!bits.length) return "Saved.";
  return bits.join(" ");
}

export function applyUpdate(
  before: CreatorFields,
  patch: CreatorPatch,
  now = new Date(),
): { ok: true; next: CreatorFields; detail: string } | { ok: false; error: string } {
  if (patch.via === "accept") {
    if (before.stage !== "inquiry") return { ok: false, error: "Only an inquiry can be accepted." };
    if (patch.stage && patch.stage !== "approved") return { ok: false, error: "Accept moves an inquiry to Approved." };
  }
  if (patch.via === "decline") {
    if (before.stage !== "inquiry") return { ok: false, error: "Only an inquiry can be declined." };
    if (patch.stage && patch.stage !== "declined") return { ok: false, error: "Decline moves an inquiry to Declined." };
  }

  const next: CreatorFields = {
    name: patch.name ?? before.name,
    handle: patch.handle ?? before.handle,
    email: patch.email ?? before.email,
    shopifyOrder: patch.shopifyOrder ?? before.shopifyOrder,
    stage: patch.via === "accept" ? "approved" : patch.via === "decline" ? "declined" : (patch.stage ?? before.stage),
    rush: patch.rush ?? before.rush,
    cardMessage: patch.cardMessage ?? before.cardMessage,
    notes: patch.notes ?? before.notes,
    shipDate: patch.shipDate !== undefined ? patch.shipDate : before.shipDate,
    courier: patch.courier ?? before.courier,
    trackingNumber: patch.trackingNumber ?? before.trackingNumber,
    declineReason: patch.declineReason ?? before.declineReason,
    posted: patch.posted ?? before.posted,
    postUrl: patch.postUrl ?? before.postUrl,
    views: patch.views !== undefined ? patch.views : before.views,
    orders: patch.orders !== undefined ? patch.orders : before.orders,
    rating: patch.rating !== undefined ? patch.rating : before.rating,
    worksWell: patch.worksWell ?? before.worksWell,
    tiktokOrderId: patch.tiktokOrderId ?? before.tiktokOrderId,
    tiktokMessage: patch.tiktokMessage ?? before.tiktokMessage,
  };

  if (!next.name.trim()) return { ok: false, error: "A name is required." };

  if (next.stage === "shipped" && before.stage !== "shipped" && !next.shipDate) {
    next.shipDate = londonToday(now);
  }
  if (next.stage === "posted" && before.stage !== "posted") {
    next.posted = true;
  }

  return { ok: true, next, detail: describeChanges(before, next, patch.via) };
}
