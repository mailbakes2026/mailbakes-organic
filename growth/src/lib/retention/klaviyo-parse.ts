import { toPence } from "@/lib/money";
import { rateFromCounts } from "@/lib/retention/metrics";

export type SendDraft = {
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
  source: "klaviyo";
};

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function whole(value: unknown) {
  const number = num(value);
  if (number === null || number < 0) return null;
  return Math.round(number);
}

function groupingId(groupings: unknown, keys: string[]): string {
  if (Array.isArray(groupings)) {
    for (const item of groupings) {
      const id = groupingId(item, keys);
      if (id) return id;
    }
    return "";
  }
  if (!groupings || typeof groupings !== "object") return "";
  const record = groupings as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return "";
}

export function parseValuesReport(body: unknown, window: "7d" | "30d", idKeys: string[]) {
  const data = body && typeof body === "object" ? (body as { data?: { attributes?: { results?: unknown } } }).data : null;
  const results = data?.attributes?.results;
  if (!Array.isArray(results)) return [];
  const grouped = new Map<string, SendDraft>();
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const record = result as { groupings?: unknown; statistics?: Record<string, unknown> };
    const id = groupingId(record.groupings, idKeys);
    if (!id) continue;
    const stats = record.statistics ?? {};
    const current = grouped.get(id) ?? {
      id,
      name: id,
      window,
      revenuePence: null,
      opens: null,
      clicks: null,
      delivered: null,
      unsubscribes: null,
      openRate: null,
      clickRate: null,
      currency: "",
      source: "klaviyo" as const,
    };
    const revenue = num(stats.conversion_value);
    if (revenue !== null) {
      const pence = toPence(revenue.toFixed(4));
      current.revenuePence = (current.revenuePence ?? 0) + (pence ?? 0);
    }
    for (const [field, key] of [
      ["opens", "opens"],
      ["clicks", "clicks"],
      ["unsubscribes", "unsubscribes"],
    ] as const) {
      const value = whole(stats[key]);
      if (value !== null) current[field] = (current[field] ?? 0) + value;
    }
    const reached = whole(stats.delivered) ?? whole(stats.recipients);
    if (reached !== null) current.delivered = (current.delivered ?? 0) + reached;
    grouped.set(id, current);
  }
  return [...grouped.values()].map((row) => ({
    ...row,
    openRate: rateFromCounts(row.opens, row.delivered),
    clickRate: rateFromCounts(row.clicks, row.delivered),
  }));
}

export function parseNamedResources(body: unknown) {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : null;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { id?: unknown; attributes?: { name?: unknown } };
    if (typeof record.id !== "string" || !record.id) return [];
    const name = typeof record.attributes?.name === "string" ? record.attributes.name : record.id;
    return [{ id: record.id, name }];
  });
}

export function parsePlacedOrderMetric(body: unknown) {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : null;
  if (!Array.isArray(data)) return null;
  const metrics = data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { id?: unknown; attributes?: { name?: unknown } };
    if (typeof record.id !== "string" || typeof record.attributes?.name !== "string") return [];
    return [{ id: record.id, name: record.attributes.name }];
  });
  return metrics.find((metric) => metric.name === "Placed Order")?.id ?? metrics.find((metric) => metric.name.toLowerCase() === "placed order")?.id ?? null;
}

export function parseLists(body: unknown) {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : null;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { id?: unknown; attributes?: { name?: unknown; profile_count?: unknown } };
    if (typeof record.id !== "string" || !record.id) return [];
    const profiles = record.attributes?.profile_count;
    return [
      {
        listId: record.id,
        listName: typeof record.attributes?.name === "string" && record.attributes.name ? record.attributes.name : record.id,
        profiles: typeof profiles === "number" && Number.isFinite(profiles) ? Math.max(0, Math.round(profiles)) : null,
      },
    ];
  });
}

export function klaviyoError(body: unknown) {
  if (!body || typeof body !== "object" || !("errors" in body)) return "";
  const errors = (body as { errors?: { detail?: unknown; title?: unknown }[] }).errors;
  const first = errors?.[0];
  if (typeof first?.detail === "string" && first.detail) return first.detail;
  if (typeof first?.title === "string") return first.title;
  return "";
}

export function safeKlaviyoNext(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "a.klaviyo.com") return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
