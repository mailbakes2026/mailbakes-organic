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
};

export type NameCreator = {
  id: string;
  name: string;
  tiktokOrderId: string;
  tiktokMessage: string;
  opsStatus: string;
};

export type NameMatch = { creatorId: string; parcel: TikTokParcel };

export type MatchState = "matched" | "sent" | "unmatched" | "not_ready" | "not_configured" | "failed" | "busy";

export type MatchLine = { id: string; state: MatchState; label: string };

export type ReviewItem = {
  tiktokOrderId: string;
  recipient: string;
  reference: string;
  freeSample: boolean;
  reason: string;
};

export type NamePlan = {
  matches: NameMatch[];
  review: ReviewItem[];
  lines: MatchLine[];
};

const NOT_READY = "Orders app not ready.";

/** Case, whitespace, and accent insensitive. Parentheses and spelling stay, so a short name is not a guess. */
export function normalisePersonName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s\u00a0]+/g, " ")
    .trim()
    .toLocaleLowerCase("en-GB");
}

export function matchSummary(input: { state: MatchState; error?: string; matched: number; sent: number; unmatched: number; failed?: number }) {
  if (input.state === "not_ready") return NOT_READY;
  if (input.state === "not_configured") return "Not configured. Set OPS_APP_URL and OPS_API_TOKEN on the server.";
  if (input.state === "busy") return "Matching orders…";
  if (input.state === "failed") return input.error ? `Failed: ${publicError(input.error)}` : "Failed.";
  const base = `Matched ${input.matched}. Sent ${input.sent}. Unmatched ${input.unmatched}.`;
  if (input.failed) return `${base} Failed ${input.failed}.`;
  return base;
}

/** Post the saved Creators message. An order that is already marked sent for this same ID is left alone. */
export function shouldPostMatchedMessage(input: { tiktokMessage: string; tiktokOrderId: string; parcelId: string; opsStatus: string }) {
  if (!input.tiktokMessage.trim()) return false;
  return !(input.tiktokOrderId === input.parcelId && input.opsStatus === "sent");
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
  if (!parsed.ok || !parsed.value) {
    return {
      review: {
        tiktokOrderId: "",
        recipient: recipient || "No recipient name",
        reference,
        freeSample,
        reason: "Unmatched. The TikTok order ID was not text, so it was not used.",
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

/** Exact normalised names only. Two creators or two parcels with the same name are left for Millie. */
export function planNameMatches(creators: NameCreator[], parcels: TikTokParcel[]): NamePlan {
  const creatorsByName = new Map<string, NameCreator[]>();
  for (const creator of creators) {
    const key = normalisePersonName(creator.name);
    if (!key) continue;
    const group = creatorsByName.get(key) ?? [];
    group.push(creator);
    creatorsByName.set(key, group);
  }
  const parcelsByName = new Map<string, TikTokParcel[]>();
  const review: ReviewItem[] = [];
  for (const parcel of parcels) {
    const key = normalisePersonName(parcel.recipient);
    if (!key) {
      review.push({
        tiktokOrderId: parcel.tiktokOrderId,
        recipient: "No recipient name",
        reference: parcel.reference,
        freeSample: parcel.freeSample,
        reason: "Unmatched. The orders app did not send a recipient name.",
      });
      continue;
    }
    const group = parcelsByName.get(key) ?? [];
    group.push(parcel);
    parcelsByName.set(key, group);
  }

  const matches: NameMatch[] = [];
  const ambiguousIds = new Set<string>();
  const conflictIds = new Set<string>();
  for (const [key, namedParcels] of parcelsByName) {
    const namedCreators = creatorsByName.get(key) ?? [];
    if (namedCreators.length === 1 && namedParcels.length === 1) {
      const creator = namedCreators[0];
      const parcel = namedParcels[0];
      if (creator.tiktokOrderId.trim() && creator.tiktokOrderId !== parcel.tiktokOrderId) {
        conflictIds.add(creator.id);
        review.push({
          tiktokOrderId: parcel.tiktokOrderId,
          recipient: parcel.recipient,
          reference: parcel.reference,
          freeSample: parcel.freeSample,
          reason: `Unmatched. ${creator.name} already has a different TikTok order ID.`,
        });
        continue;
      }
      matches.push({ creatorId: creator.id, parcel });
      continue;
    }
    const reason =
      namedCreators.length === 0
        ? "Unmatched."
        : "Unmatched. More than one creator or order uses this name.";
    for (const creator of namedCreators) ambiguousIds.add(creator.id);
    for (const parcel of namedParcels) {
      review.push({
        tiktokOrderId: parcel.tiktokOrderId,
        recipient: parcel.recipient,
        reference: parcel.reference,
        freeSample: parcel.freeSample,
        reason,
      });
    }
  }

  const lines: MatchLine[] = creators.map((creator) => {
    const match = matches.find((item) => item.creatorId === creator.id);
    if (match) {
      const aligned = creator.tiktokOrderId === match.parcel.tiktokOrderId;
      if (aligned && creator.tiktokMessage.trim() && creator.opsStatus === "sent") return lineFor(creator.id, "sent", "Sent.");
      return lineFor(creator.id, "matched", "Matched.");
    }
    if (conflictIds.has(creator.id)) return lineFor(creator.id, "unmatched", "Unmatched. This sample already has a different TikTok order ID.");
    if (ambiguousIds.has(creator.id)) return lineFor(creator.id, "unmatched", "Unmatched. More than one creator or order uses this name.");
    return lineFor(creator.id, "unmatched", "Unmatched.");
  });

  return { matches, review, lines };
}

export function linesAfterSend(lines: MatchLine[], sentIds: Set<string>, failed: { id: string; error: string }[]) {
  const failedById = new Map(failed.map((item) => [item.id, publicError(item.error)]));
  return lines.map((line) => {
    if (failedById.has(line.id)) return { id: line.id, state: "failed" as const, label: `Failed: ${failedById.get(line.id)}` };
    if (sentIds.has(line.id)) return { id: line.id, state: "sent" as const, label: "Sent." };
    return line;
  });
}
