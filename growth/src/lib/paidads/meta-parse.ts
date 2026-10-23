import { toPence } from "@/lib/money";

const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

type Action = { action_type?: string; value?: string | number };

export function purchaseFromInsight(actions: unknown, actionValues: unknown) {
  const actionList = Array.isArray(actions) ? (actions as Action[]) : [];
  const valueList = Array.isArray(actionValues) ? (actionValues as Action[]) : [];
  for (const type of PURCHASE_TYPES) {
    const action = actionList.find((item) => item?.action_type === type);
    const value = valueList.find((item) => item?.action_type === type);
    if (!action && !value) continue;
    const orders = action ? Number(action.value) : 0;
    const revenue = value ? Number(value.value) : 0;
    return {
      orders: Number.isFinite(orders) ? Math.max(0, Math.round(orders)) : 0,
      revenue: Number.isFinite(revenue) ? revenue : 0,
      used: type,
    };
  }
  return { orders: 0, revenue: 0, used: null as string | null };
}

export type MetaLevel = "account" | "campaign" | "adset";

export type ParsedInsight = {
  platform: "meta";
  level: MetaLevel;
  date: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  spendPence: number;
  revenuePence: number;
  orders: number;
  impressions: number | null;
  clicks: number | null;
  currency: string;
  source: "meta";
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalInt(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

export function parseInsightRow(value: unknown, level: MetaLevel): ParsedInsight | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const date = text(row.date_start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const spend = toPence(typeof row.spend === "number" ? String(row.spend) : row.spend);
  if (spend === null) return null;
  const currency = text(row.account_currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  const purchase = purchaseFromInsight(row.actions, row.action_values);
  const revenue = toPence(String(purchase.revenue));
  return {
    platform: "meta",
    level,
    date,
    campaignId: text(row.campaign_id),
    campaignName: text(row.campaign_name).slice(0, 200),
    adsetId: text(row.adset_id),
    adsetName: text(row.adset_name).slice(0, 200),
    spendPence: spend,
    revenuePence: revenue ?? 0,
    orders: purchase.orders,
    impressions: optionalInt(row.impressions),
    clicks: optionalInt(row.clicks),
    currency,
    source: "meta",
  };
}

export function parseInsightsPage(body: unknown, level: MetaLevel) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const data = Array.isArray(record.data) ? record.data : [];
  const rows = data.map((item) => parseInsightRow(item, level)).filter((item): item is ParsedInsight => Boolean(item));
  const paging = record.paging && typeof record.paging === "object" ? (record.paging as { next?: unknown }).next : null;
  return { rows, next: typeof paging === "string" ? paging : null };
}

export function metaErrorMessage(body: unknown) {
  if (!body || typeof body !== "object" || !("error" in body)) return "";
  const error = (body as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : "";
}

export function safeGraphNext(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "graph.facebook.com") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normaliseAccount(id: string) {
  const trimmed = id.trim();
  if (/^act_\d+$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `act_${trimmed}`;
  throw new Error("META_AD_ACCOUNT_ID should be the ad account number, with or without the act_ prefix.");
}
