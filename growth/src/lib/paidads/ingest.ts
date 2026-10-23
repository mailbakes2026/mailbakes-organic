import { parseDateOnly } from "@/lib/dates";
import { optionalCount, toCount, toPence } from "@/lib/money";

export type IngestRow = {
  platform: "meta" | "google";
  level: "account" | "campaign" | "adset";
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
  source: "ingest";
};

const PLATFORMS = new Set(["meta", "google"]);
const LEVELS = new Set(["account", "campaign", "adset"]);

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parsePaidIngest(value: unknown): { ok: true; rows: IngestRow[] } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Send a JSON object with platform, currency, and rows." };
  }
  const body = value as { platform?: unknown; currency?: unknown; rows?: unknown };
  const platform = text(body.platform, 20);
  if (!PLATFORMS.has(platform)) return { ok: false, error: "platform must be meta or google." };
  const currency = text(body.currency, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "currency must be a 3-letter code." };
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return { ok: false, error: "rows must be a non-empty list." };
  }
  if (body.rows.length > 500) return { ok: false, error: "Send at most 500 rows at a time." };

  const rows: IngestRow[] = [];
  for (let index = 0; index < body.rows.length; index++) {
    const item = body.rows[index];
    if (!item || typeof item !== "object") return { ok: false, error: `Row ${index + 1} is not an object.` };
    const record = item as Record<string, unknown>;
    const level = text(record.level, 20);
    if (!LEVELS.has(level)) return { ok: false, error: `Row ${index + 1} level must be account, campaign, or adset.` };
    const date = text(record.date, 10);
    if (!parseDateOnly(date)) return { ok: false, error: `Row ${index + 1} date must be YYYY-MM-DD.` };
    if (!("spend" in record) || !("revenue" in record) || !("orders" in record)) {
      return { ok: false, error: `Row ${index + 1} needs spend, revenue, and orders. Leave a field out only when you do not have it, and do not send a guess.` };
    }
    const spendPence = toPence(record.spend);
    const revenuePence = toPence(record.revenue);
    const orders = toCount(record.orders);
    if (spendPence === null || revenuePence === null || orders === null) {
      return { ok: false, error: `Row ${index + 1} has a spend, revenue, or orders value that is not a number.` };
    }
    const impressions = optionalCount(record.impressions);
    const clicks = optionalCount(record.clicks);
    if (impressions === undefined || clicks === undefined) {
      return { ok: false, error: `Row ${index + 1} impressions and clicks must be whole numbers, or omitted.` };
    }
    const campaignId = text(record.campaignId, 80);
    const campaignName = text(record.campaignName);
    const adsetId = text(record.adsetId, 80);
    const adsetName = text(record.adsetName);
    if (level === "campaign" && !campaignId && !campaignName) {
      return { ok: false, error: `Row ${index + 1} needs a campaign id or name.` };
    }
    if (level === "adset" && !adsetId && !adsetName) {
      return { ok: false, error: `Row ${index + 1} needs an ad set id or name.` };
    }
    rows.push({
      platform: platform as "meta" | "google",
      level: level as IngestRow["level"],
      date,
      campaignId,
      campaignName,
      adsetId,
      adsetName,
      spendPence,
      revenuePence,
      orders,
      impressions,
      clicks,
      currency,
      source: "ingest",
    });
  }
  return { ok: true, rows };
}
