import { isStageSlug, type StageSlug } from "./stages.ts";
import { parseDateOnly } from "./dates.ts";
import { normaliseHandle } from "./tiktok.ts";
import { safeHttpUrl } from "./tracking.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_COUNT = 1_000_000_000;

export type InquiryInput = {
  name: string;
  handle: string;
  email: string;
  shopifyOrder: string;
  cardMessage: string;
  notes: string;
  rush: boolean;
};

export type CreatorPatch = {
  name?: string;
  handle?: string;
  email?: string;
  shopifyOrder?: string;
  stage?: StageSlug;
  rush?: boolean;
  cardMessage?: string;
  notes?: string;
  shipDate?: string | null;
  courier?: string;
  trackingNumber?: string;
  declineReason?: string;
  posted?: boolean;
  postUrl?: string;
  views?: number | null;
  orders?: number | null;
  rating?: number | null;
  worksWell?: boolean;
  via?: "accept" | "decline";
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function asObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function oneLine(value: string, max: number): string | null {
  const trimmed = value.trim();
  if (trimmed.length > max) return null;
  if (/[\u0000-\u001F]/.test(trimmed)) return null;
  return trimmed;
}

function manyLines(value: string, max: number): string | null {
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  if (trimmed.length > max) return null;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(trimmed)) return null;
  return trimmed;
}

function readLine(source: Record<string, unknown>, key: string, max: number, label: string): ParseResult<string | undefined> {
  if (!(key in source)) return { ok: true, value: undefined };
  const raw = source[key];
  if (typeof raw !== "string") return { ok: false, error: `${label} should be text.` };
  const value = oneLine(raw, max);
  if (value === null) return { ok: false, error: `${label} is too long.` };
  return { ok: true, value };
}

function readLines(source: Record<string, unknown>, key: string, max: number, label: string): ParseResult<string | undefined> {
  if (!(key in source)) return { ok: true, value: undefined };
  const raw = source[key];
  if (typeof raw !== "string") return { ok: false, error: `${label} should be text.` };
  const value = manyLines(raw, max);
  if (value === null) return { ok: false, error: `${label} is too long.` };
  return { ok: true, value };
}

function readEmail(source: Record<string, unknown>, required: boolean): ParseResult<string | undefined> {
  if (!("email" in source)) {
    if (required) return { ok: true, value: "" };
    return { ok: true, value: undefined };
  }
  const raw = source.email;
  if (typeof raw !== "string") return { ok: false, error: "Email should be text." };
  const value = oneLine(raw, 160);
  if (value === null) return { ok: false, error: "Email is too long." };
  if (value && !EMAIL.test(value)) return { ok: false, error: "That email doesn't look right." };
  return { ok: true, value };
}

function readBool(source: Record<string, unknown>, key: string, label: string): ParseResult<boolean | undefined> {
  if (!(key in source)) return { ok: true, value: undefined };
  if (typeof source[key] !== "boolean") return { ok: false, error: `${label} should be true or false.` };
  return { ok: true, value: source[key] as boolean };
}

function readCount(source: Record<string, unknown>, key: string, label: string): ParseResult<number | null | undefined> {
  if (!(key in source)) return { ok: true, value: undefined };
  const raw = source[key];
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > MAX_COUNT) {
    return { ok: false, error: `${label} should be a whole number.` };
  }
  return { ok: true, value: raw };
}

function readTracking(source: Record<string, unknown>): ParseResult<string | undefined> {
  if (!("trackingNumber" in source)) return { ok: true, value: undefined };
  const raw = source.trackingNumber;
  if (typeof raw !== "string") return { ok: false, error: "Tracking number should be text." };
  const value = oneLine(raw, 40);
  if (value === null) return { ok: false, error: "Tracking number is too long." };
  if (value && !/^[A-Za-z0-9][A-Za-z0-9 -]{0,39}$/.test(value)) {
    return { ok: false, error: "Enter the tracking number, not a link." };
  }
  return { ok: true, value };
}

function readHandle(source: Record<string, unknown>): ParseResult<string | undefined> {
  if (!("handle" in source)) return { ok: true, value: undefined };
  const raw = source.handle;
  if (typeof raw !== "string") return { ok: false, error: "TikTok handle should be text." };
  const value = oneLine(raw, 300);
  if (value === null) return { ok: false, error: "TikTok handle is too long." };
  return normaliseHandle(value);
}

function readPostUrl(source: Record<string, unknown>): ParseResult<string | undefined> {
  if (!("postUrl" in source)) return { ok: true, value: undefined };
  const raw = source.postUrl;
  if (typeof raw !== "string") return { ok: false, error: "Post link should be text." };
  const value = oneLine(raw, 500);
  if (value === null) return { ok: false, error: "Post link is too long." };
  if (value && !safeHttpUrl(value)) return { ok: false, error: "Post link should be a full https:// address." };
  return { ok: true, value };
}

function readShipDate(source: Record<string, unknown>): ParseResult<string | null | undefined> {
  if (!("shipDate" in source)) return { ok: true, value: undefined };
  const raw = source.shipDate;
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Ship date should be a date." };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!parseDateOnly(trimmed)) return { ok: false, error: "Ship date should be YYYY-MM-DD." };
  return { ok: true, value: trimmed };
}

export function parseInquiry(body: unknown): ParseResult<InquiryInput> {
  const source = asObject(body);
  if (!source) return { ok: false, error: "Send a JSON object." };

  const nameResult = readLine(source, "name", 120, "Name");
  if (!nameResult.ok) return nameResult;
  const name = nameResult.value?.trim() ?? "";
  if (!name) return { ok: false, error: "A name is required." };

  const handle = readHandle(source);
  if (!handle.ok) return handle;
  const email = readEmail(source, true);
  if (!email.ok) return email;
  const order = readLine(source, "shopifyOrder", 40, "Shopify order");
  if (!order.ok) return order;
  const message = readLines(source, "cardMessage", 2000, "Card message");
  if (!message.ok) return message;
  const notes = readLines(source, "notes", 4000, "Notes");
  if (!notes.ok) return notes;
  const rush = readBool(source, "rush", "Rush");
  if (!rush.ok) return rush;

  return {
    ok: true,
    value: {
      name,
      handle: handle.value ?? "",
      email: email.value ?? "",
      shopifyOrder: order.value ?? "",
      cardMessage: message.value ?? "",
      notes: notes.value ?? "",
      rush: rush.value ?? false,
    },
  };
}

export function parsePatch(body: unknown): ParseResult<CreatorPatch> {
  const source = asObject(body);
  if (!source) return { ok: false, error: "Send a JSON object." };
  const patch: CreatorPatch = {};

  const name = readLine(source, "name", 120, "Name");
  if (!name.ok) return name;
  if (name.value !== undefined) {
    if (!name.value) return { ok: false, error: "A name is required." };
    patch.name = name.value;
  }

  const handle = readHandle(source);
  if (!handle.ok) return handle;
  if (handle.value !== undefined) patch.handle = handle.value;

  const email = readEmail(source, false);
  if (!email.ok) return email;
  if (email.value !== undefined) patch.email = email.value;

  const order = readLine(source, "shopifyOrder", 40, "Shopify order");
  if (!order.ok) return order;
  if (order.value !== undefined) patch.shopifyOrder = order.value;

  if ("stage" in source) {
    if (typeof source.stage !== "string" || !isStageSlug(source.stage)) {
      return { ok: false, error: "That stage isn't on the board." };
    }
    patch.stage = source.stage;
  }

  const rush = readBool(source, "rush", "Rush");
  if (!rush.ok) return rush;
  if (rush.value !== undefined) patch.rush = rush.value;

  const message = readLines(source, "cardMessage", 2000, "Card message");
  if (!message.ok) return message;
  if (message.value !== undefined) patch.cardMessage = message.value;

  const notes = readLines(source, "notes", 4000, "Notes");
  if (!notes.ok) return notes;
  if (notes.value !== undefined) patch.notes = notes.value;

  const shipDate = readShipDate(source);
  if (!shipDate.ok) return shipDate;
  if (shipDate.value !== undefined) patch.shipDate = shipDate.value;

  const courier = readLine(source, "courier", 60, "Courier");
  if (!courier.ok) return courier;
  if (courier.value !== undefined) patch.courier = courier.value;

  const tracking = readTracking(source);
  if (!tracking.ok) return tracking;
  if (tracking.value !== undefined) patch.trackingNumber = tracking.value;

  const reason = readLines(source, "declineReason", 500, "Decline reason");
  if (!reason.ok) return reason;
  if (reason.value !== undefined) patch.declineReason = reason.value;

  const posted = readBool(source, "posted", "Posted");
  if (!posted.ok) return posted;
  if (posted.value !== undefined) patch.posted = posted.value;

  const postUrl = readPostUrl(source);
  if (!postUrl.ok) return postUrl;
  if (postUrl.value !== undefined) patch.postUrl = postUrl.value;

  const views = readCount(source, "views", "Views");
  if (!views.ok) return views;
  if (views.value !== undefined) patch.views = views.value;

  const orders = readCount(source, "orders", "Orders");
  if (!orders.ok) return orders;
  if (orders.value !== undefined) patch.orders = orders.value;

  if ("rating" in source) {
    const raw = source.rating;
    if (raw === null) patch.rating = null;
    else if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 5) {
      return { ok: false, error: "Rating should be from 1 to 5." };
    } else patch.rating = raw;
  }

  const worksWell = readBool(source, "worksWell", "Works well");
  if (!worksWell.ok) return worksWell;
  if (worksWell.value !== undefined) patch.worksWell = worksWell.value;

  if ("via" in source) {
    if (source.via !== "accept" && source.via !== "decline") {
      return { ok: false, error: "That action isn't available." };
    }
    patch.via = source.via;
  }

  return { ok: true, value: patch };
}
