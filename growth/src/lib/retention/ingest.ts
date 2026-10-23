import { parseDateOnly } from "@/lib/dates";
import { optionalCount, toCount, toPence } from "@/lib/money";
import { rateFromCounts } from "@/lib/retention/metrics";

export type IngestSend = {
  id: string;
  name: string;
  window: "7d" | "30d";
  revenuePence: number | null;
  opens: number | null;
  clicks: number | null;
  delivered: number | null;
  unsubscribes: number | null;
  openRate: number | null;
  clickRate: number | null;
  currency: string;
  source: "ingest";
};

export type IngestList = {
  listId: string;
  listName: string;
  profiles: number | null;
  capturedOn: string;
  source: "ingest";
};

export type IngestOrder = {
  id: string;
  customerId: string;
  orderedOn: string;
  totalPence: number;
  currency: string;
  source: "ingest";
};

export type RetentionIngest = {
  flows: IngestSend[];
  campaigns: IngestSend[];
  lists: IngestList[];
  orders: IngestOrder[];
  replaceOrders: boolean;
};

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function send(value: unknown, index: number, label: string): IngestSend | { error: string } {
  if (!value || typeof value !== "object") return { error: `${label} ${index + 1} is not an object.` };
  const record = value as Record<string, unknown>;
  const id = text(record.id, 80);
  const name = text(record.name);
  const window = text(record.window, 8);
  if (!id || !name) return { error: `${label} ${index + 1} needs an id and a name.` };
  if (window !== "7d" && window !== "30d") return { error: `${label} ${index + 1} window must be 7d or 30d.` };
  const revenue = record.revenue === undefined || record.revenue === null ? null : toPence(record.revenue);
  if (record.revenue !== undefined && record.revenue !== null && revenue === null) {
    return { error: `${label} ${index + 1} revenue is not a number.` };
  }
  const currency = text(record.currency, 3).toUpperCase();
  if (revenue !== null && !/^[A-Z]{3}$/.test(currency)) {
    return { error: `${label} ${index + 1} needs a currency when revenue is set.` };
  }
  const opens = optionalCount(record.opens);
  const clicks = optionalCount(record.clicks);
  const delivered = optionalCount(record.delivered);
  const unsubscribes = optionalCount(record.unsubscribes);
  if ([opens, clicks, delivered, unsubscribes].some((item) => item === undefined)) {
    return { error: `${label} ${index + 1} has a count that is not a whole number.` };
  }
  return {
    id,
    name,
    window,
    revenuePence: revenue,
    opens: opens ?? null,
    clicks: clicks ?? null,
    delivered: delivered ?? null,
    unsubscribes: unsubscribes ?? null,
    openRate: rateFromCounts(opens ?? null, delivered ?? null),
    clickRate: rateFromCounts(clicks ?? null, delivered ?? null),
    currency,
    source: "ingest",
  };
}

export function parseRetentionIngest(value: unknown): { ok: true; value: RetentionIngest } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Send a JSON object with flows, campaigns, lists, or orders." };
  }
  const body = value as { flows?: unknown; campaigns?: unknown; lists?: unknown; orders?: unknown; replaceOrders?: unknown };
  if (body.replaceOrders !== undefined && typeof body.replaceOrders !== "boolean") {
    return { ok: false, error: "replaceOrders must be true or false." };
  }
  const flows = readSends(body.flows, "Flow");
  if ("error" in flows) return { ok: false, error: flows.error ?? "That payload was not valid." };
  const campaigns = readSends(body.campaigns, "Campaign");
  if ("error" in campaigns) return { ok: false, error: campaigns.error ?? "That payload was not valid." };
  const lists = readLists(body.lists);
  if ("error" in lists) return { ok: false, error: lists.error ?? "That payload was not valid." };
  const orders = readOrders(body.orders);
  if ("error" in orders) return { ok: false, error: orders.error ?? "That payload was not valid." };
  if (!flows.rows.length && !campaigns.rows.length && !lists.rows.length && !orders.rows.length) {
    return { ok: false, error: "Include at least one flow, campaign, list, or order." };
  }
  return {
    ok: true,
    value: {
      flows: flows.rows,
      campaigns: campaigns.rows,
      lists: lists.rows,
      orders: orders.rows,
      replaceOrders: body.replaceOrders === true,
    },
  };
}

function readSends(value: unknown, label: string) {
  if (value === undefined) return { rows: [] as IngestSend[] };
  if (!Array.isArray(value)) return { error: `${label}s must be a list.` };
  if (value.length > 500) return { error: `Send at most 500 ${label.toLowerCase()}s.` };
  const rows: IngestSend[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const row = send(value[index], index, label);
    if ("error" in row) return { error: row.error ?? "That row was not valid." };
    rows.push(row);
  }
  return { rows };
}

function readLists(value: unknown) {
  if (value === undefined) return { rows: [] as IngestList[] };
  if (!Array.isArray(value)) return { error: "Lists must be a list." };
  if (value.length > 200) return { error: "Send at most 200 lists." };
  const rows: IngestList[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!item || typeof item !== "object") return { error: `List ${index + 1} is not an object.` };
    const record = item as Record<string, unknown>;
    const listId = text(record.id, 80);
    const listName = text(record.name);
    const capturedOn = text(record.capturedOn, 10);
    if (!listId || !listName || !parseDateOnly(capturedOn)) {
      return { error: `List ${index + 1} needs an id, a name, and capturedOn as YYYY-MM-DD.` };
    }
    const profiles = record.profiles === undefined || record.profiles === null ? null : toCount(record.profiles);
    if (record.profiles !== undefined && record.profiles !== null && profiles === null) {
      return { error: `List ${index + 1} profiles is not a whole number.` };
    }
    rows.push({ listId, listName, profiles, capturedOn, source: "ingest" });
  }
  return { rows };
}

function readOrders(value: unknown) {
  if (value === undefined) return { rows: [] as IngestOrder[] };
  if (!Array.isArray(value)) return { error: "Orders must be a list." };
  if (value.length > 2000) return { error: "Send at most 2000 orders." };
  const rows: IngestOrder[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!item || typeof item !== "object") return { error: `Order ${index + 1} is not an object.` };
    const record = item as Record<string, unknown>;
    const id = text(record.id, 120);
    const orderedOn = text(record.orderedOn, 10);
    const currency = text(record.currency, 3).toUpperCase();
    const total = toPence(record.total);
    if (!id || !parseDateOnly(orderedOn) || total === null || !/^[A-Z]{3}$/.test(currency)) {
      return { error: `Order ${index + 1} needs an id, orderedOn, total, and currency.` };
    }
    rows.push({
      id,
      customerId: text(record.customerId, 120),
      orderedOn,
      totalPence: total,
      currency,
      source: "ingest",
    });
  }
  return { rows };
}
