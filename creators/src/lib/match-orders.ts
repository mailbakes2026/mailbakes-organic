import { matchStatusClass } from "./match-status.ts";
import { readTiktokOrderId } from "./ops.ts";

export { matchStatusClass };

export type TikTokParcel = {
  reference: string;
  tiktokOrderId: string;
  recipient: string;
  freeSample: boolean;
  hasMessage: boolean;
  message: string;
  status: string;
};

export type NameCreator = {
  id: string;
  name: string;
  tiktokOrderId: string;
  tiktokMessage: string;
  opsStatus: string;
};

export type MatchState = "matched" | "sent" | "needs_review" | "no_order" | "not_ready" | "not_configured" | "failed" | "busy";

export type MatchLine = { id: string; state: MatchState; label: string };

export type Candidate = { id: string; name: string };

export type ReviewItem = {
  tiktokOrderId: string;
  recipient: string;
  reference: string;
  freeSample: boolean;
  reason: string;
  candidates: Candidate[];
};

export type UnclaimedOrder = {
  tiktokOrderId: string;
  recipient: string;
  reference: string;
  freeSample: boolean;
  status: string;
};

export type NameMatch = { creatorId: string; parcel: TikTokParcel; by: "id" | "name" };

export type NamePlan = {
  matches: NameMatch[];
  review: ReviewItem[];
  unclaimed: UnclaimedOrder[];
  older: UnclaimedOrder[];
  lines: MatchLine[];
};

const NOT_READY = "Orders app not ready.";

/** Case-insensitive, trimmed, punctuation ignored. Leftover words still have to match, so a shorter name is not a guess. */
export function normalisePersonName(value: string) {
  return value
    .replace(/\p{P}+/gu, " ")
    .replace(/[\s\u00a0]+/g, " ")
    .trim()
    .toLocaleLowerCase("en-GB");
}

export function matchSummary(input: {
  state: MatchState;
  error?: string;
  matched: number;
  needsReview: number;
  noOrder: number;
  unclaimed: number;
  sent?: number;
  failed?: number;
}) {
  if (input.state === "not_ready") return NOT_READY;
  if (input.state === "not_configured") return "Not configured. Set OPS_APP_URL and OPS_API_TOKEN on the server.";
  if (input.state === "busy") return "Matching orders…";
  if (input.state === "failed") return input.error ? `Failed: ${publicError(input.error)}` : "Failed.";
  const sent = input.sent ? ` Sent ${input.sent}.` : "";
  const failed = input.failed ? ` Failed ${input.failed}.` : "";
  return `Matched ${input.matched}.${sent} Needs review ${input.needsReview}. No order found ${input.noOrder}. Orders with no creator ${input.unclaimed}.${failed}`;
}

/** On hold still needs a note. A processed order needs one only while it has no message. Finished orders wait under Older orders. */
export function orderNeedsAction(order: { status: string; hasMessage: boolean; message: string }) {
  const status = order.status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!status) return true;
  if (status === "on_hold" || status === "hold") return true;
  if (status === "processed") return !order.hasMessage && order.message.trim() === "";
  return false;
}

export function orderStatusLabel(status: string) {
  const key = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key === "on_hold" || key === "hold") return "On hold";
  if (key === "processed") return "Processed";
  if (key === "complete") return "Complete";
  if (key === "cancelled" || key === "canceled") return "Cancelled";
  if (!key) return "";
  return key.replace(/_/g, " ");
}

/** A pasted note is stored as she typed it. No message stores nothing. */
export function readOrderAction(input: { name: unknown; message: unknown; noMessage: unknown }) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { ok: false as const, error: "A name is required." };
  if (name.length > 120) return { ok: false as const, error: "That name is too long." };
  if (input.noMessage === true) return { ok: true as const, name, message: "", noMessage: true as const };
  if (typeof input.message !== "string") return { ok: false as const, error: "Paste the note first." };
  const message = input.message.trim();
  if (!message) return { ok: false as const, error: "Paste the note first." };
  if (message.length > 300) return { ok: false as const, error: "That note is too long." };
  return { ok: true as const, name, message, noMessage: false as const };
}

/** Push a saved message only. An order that already carries that same text is left alone. */
export function shouldPushSavedMessage(saved: string, orderMessage: string) {
  const message = saved.trim();
  if (!message) return false;
  return message !== orderMessage.trim();
}

function publicError(error: string) {
  return error.replace(/bearer\s+\S+/gi, "bearer").replace(/\s+/g, " ").trim().slice(0, 180);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function flag(value: unknown) {
  return value === true;
}

function readParcel(raw: unknown): { parcel?: TikTokParcel; review?: ReviewItem } | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const recipient = text(record.recipient) || text(record.recipient_name) || text(record.ship_name) || text(record.name);
  const reference = text(record.reference) || text(record.shopify_reference) || text(record.shopify_order);
  const idRaw = "tiktok_order_id" in record ? record.tiktok_order_id : record.tiktokOrderId;
  const parsed = readTiktokOrderId(idRaw);
  const freeSample = flag(record.free_sample) || flag(record.freeSample);
  const message = text(record.message);
  const status = text(record.status);
  if (!parsed.ok) {
    return {
      review: {
        tiktokOrderId: "",
        recipient: recipient || "No recipient name",
        reference,
        freeSample,
        reason: "Needs review. The TikTok order ID was not text, so it was not used.",
        candidates: [],
      },
    };
  }
  return {
    parcel: {
      reference,
      tiktokOrderId: parsed.value,
      recipient,
      freeSample,
      hasMessage: flag(record.has_message) || flag(record.hasMessage) || message !== "",
      message,
      status,
    },
  };
}

export function interpretTiktokOrders(status: number, body: string): { state: "ready"; parcels: TikTokParcel[]; review: ReviewItem[] } | { state: "not_ready" } | { state: "failed"; error: string } {
  const clean = body.replace(/bearer\s+\S+/gi, "bearer").replace(/\s+/g, " ").trim();
  if (status === 404 || status === 405 || status === 501) return { state: "not_ready" };
  if (status === 401) {
    if (/not signed in/i.test(clean)) return { state: "not_ready" };
    return { state: "failed", error: "Bad token" };
  }
  if (status >= 300 && status < 400) return { state: "failed", error: "The orders app redirected the check." };
  if (status < 200 || status >= 300) return { state: "failed", error: `The orders app returned ${status}.` };
  if (!clean.startsWith("{") && !clean.startsWith("[")) return { state: "not_ready" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { state: "not_ready" };
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? (parsed as { orders?: unknown; parcels?: unknown }).orders ?? (parsed as { parcels?: unknown }).parcels
      : undefined;
  if (!Array.isArray(list)) return { state: "not_ready" };
  const parcels: TikTokParcel[] = [];
  const review: ReviewItem[] = [];
  for (const item of list) {
    const read = readParcel(item);
    if (!read) continue;
    if (read.parcel) parcels.push(read.parcel);
    if (read.review) review.push(read.review);
  }
  return { state: "ready", parcels, review };
}

function lineFor(id: string, state: MatchState, label: string): MatchLine {
  return { id, state, label };
}

function candidatesOf(creators: NameCreator[]): Candidate[] {
  return creators.map((creator) => ({ id: creator.id, name: creator.name }));
}

function reviewItem(parcel: TikTokParcel, reason: string, candidates: Candidate[]): ReviewItem {
  return {
    tiktokOrderId: parcel.tiktokOrderId,
    recipient: parcel.recipient || "No recipient name",
    reference: parcel.reference,
    freeSample: parcel.freeSample,
    reason,
    candidates,
  };
}

/** TikTok order ID first. A name match is kept only when one creator and one order share it. */
export function planOrderMatches(creators: NameCreator[], parcels: TikTokParcel[]): NamePlan {
  const matches: NameMatch[] = [];
  const claimedCreators = new Set<string>();
  const claimedParcelIndexes = new Set<number>();
  const review: ReviewItem[] = [];
  const reviewCreatorIds = new Set<string>();

  const creatorsById = new Map<string, NameCreator[]>();
  for (const creator of creators) {
    const id = creator.tiktokOrderId.trim();
    if (!id) continue;
    const group = creatorsById.get(id) ?? [];
    group.push(creator);
    creatorsById.set(id, group);
  }
  const parcelIndexesById = new Map<string, number[]>();
  parcels.forEach((parcel, index) => {
    const id = parcel.tiktokOrderId.trim();
    if (!id) return;
    const group = parcelIndexesById.get(id) ?? [];
    group.push(index);
    parcelIndexesById.set(id, group);
  });

  for (const [id, group] of creatorsById) {
    const indexes = parcelIndexesById.get(id) ?? [];
    if (group.length === 1 && indexes.length === 1) {
      matches.push({ creatorId: group[0].id, parcel: parcels[indexes[0]], by: "id" });
      claimedCreators.add(group[0].id);
      claimedParcelIndexes.add(indexes[0]);
      continue;
    }
    if (indexes.length === 0) continue;
    const names = candidatesOf(group);
    for (const creator of group) reviewCreatorIds.add(creator.id);
    for (const index of indexes) {
      review.push(reviewItem(parcels[index], "Needs review. More than one creator or order uses this TikTok order ID.", names));
      claimedParcelIndexes.add(index);
    }
  }

  for (const [id, indexes] of parcelIndexesById) {
    if (indexes.length < 2 || indexes.every((index) => claimedParcelIndexes.has(index))) continue;
    const names = candidatesOf(creatorsById.get(id) ?? []);
    for (const index of indexes) {
      if (claimedParcelIndexes.has(index)) continue;
      review.push(reviewItem(parcels[index], "Needs review. More than one creator or order uses this TikTok order ID.", names));
      claimedParcelIndexes.add(index);
    }
  }

  const openCreators = creators.filter((creator) => !claimedCreators.has(creator.id) && !reviewCreatorIds.has(creator.id));
  const openParcels = parcels.flatMap((parcel, index) => (claimedParcelIndexes.has(index) ? [] : [{ parcel, index }]));
  const creatorsByName = new Map<string, NameCreator[]>();
  for (const creator of openCreators) {
    const key = normalisePersonName(creator.name);
    if (!key) continue;
    const group = creatorsByName.get(key) ?? [];
    group.push(creator);
    creatorsByName.set(key, group);
  }
  const parcelsByName = new Map<string, { parcel: TikTokParcel; index: number }[]>();
  for (const item of openParcels) {
    const key = normalisePersonName(item.parcel.recipient);
    if (!key) continue;
    const group = parcelsByName.get(key) ?? [];
    group.push(item);
    parcelsByName.set(key, group);
  }

  for (const [key, namedCreators] of creatorsByName) {
    const namedParcels = parcelsByName.get(key) ?? [];
    if (namedParcels.length === 0) continue;
    const names = candidatesOf(namedCreators);
    if (namedCreators.length === 1 && namedParcels.length === 1 && !namedCreators[0].tiktokOrderId.trim()) {
      matches.push({ creatorId: namedCreators[0].id, parcel: namedParcels[0].parcel, by: "name" });
      claimedCreators.add(namedCreators[0].id);
      claimedParcelIndexes.add(namedParcels[0].index);
      continue;
    }
    const reason =
      namedCreators.length === 1 && namedParcels.length === 1
        ? "Needs review. The saved TikTok order ID does not match this order."
        : "Needs review. More than one creator or order uses this name.";
    for (const creator of namedCreators) reviewCreatorIds.add(creator.id);
    for (const item of namedParcels) {
      review.push(reviewItem(item.parcel, reason, names));
      claimedParcelIndexes.add(item.index);
    }
  }

  const unclaimed: UnclaimedOrder[] = [];
  const older: UnclaimedOrder[] = [];
  for (const [index, parcel] of parcels.entries()) {
    if (claimedParcelIndexes.has(index)) continue;
    const row: UnclaimedOrder = {
      tiktokOrderId: parcel.tiktokOrderId,
      recipient: parcel.recipient || "No recipient name",
      reference: parcel.reference,
      freeSample: parcel.freeSample,
      status: parcel.status,
    };
    if (orderNeedsAction(parcel)) unclaimed.push(row);
    else older.push(row);
  }

  const lines: MatchLine[] = creators.map((creator) => {
    if (matches.some((item) => item.creatorId === creator.id)) return lineFor(creator.id, "matched", "Matched.");
    if (reviewCreatorIds.has(creator.id)) return lineFor(creator.id, "needs_review", "Needs review.");
    return lineFor(creator.id, "no_order", "No order found.");
  });

  return { matches, review, unclaimed, older, lines };
}

export function linesAfterSend(lines: MatchLine[], sentIds: Set<string>, failed: { id: string; error: string }[]) {
  const failedById = new Map(failed.map((item) => [item.id, publicError(item.error)]));
  return lines.map((line) => {
    if (failedById.has(line.id)) return { id: line.id, state: "failed" as const, label: `Failed: ${failedById.get(line.id)}` };
    if (sentIds.has(line.id)) return { id: line.id, state: "sent" as const, label: "Sent." };
    return line;
  });
}
