import { toPence } from "@/lib/money";
import { rateFromCounts } from "@/lib/retention/metrics";

export type SendDraft = {
  id: string;
  name: string;
  window: string;
  status?: string;
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

export function parseValuesReport(body: unknown, window: string, idKeys: string[]) {
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

export function parseFlowList(body: unknown) {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : null;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { id?: unknown; attributes?: { name?: unknown; status?: unknown } };
    if (typeof record.id !== "string" || !record.id) return [];
    const name = typeof record.attributes?.name === "string" && record.attributes.name ? record.attributes.name : record.id;
    const status = typeof record.attributes?.status === "string" ? record.attributes.status : "";
    return [{ id: record.id, name, status }];
  });
}

export function parseCampaignMessage(body: unknown) {
  const root = body && typeof body === "object" ? (body as { data?: unknown; included?: unknown }) : null;
  const data = Array.isArray(root?.data) ? root.data : root?.data ? [root.data] : [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const record = item as {
      attributes?: { channel?: unknown; content?: { subject?: unknown } };
      relationships?: { template?: { data?: { id?: unknown } | { id?: unknown }[] } };
    };
    const channel = record.attributes?.channel;
    if (typeof channel === "string" && channel !== "email") continue;
    const template = record.relationships?.template?.data;
    const templateId = template && !Array.isArray(template) && typeof template.id === "string" ? template.id : "";
    if (!templateId) continue;
    const subject = typeof record.attributes?.content?.subject === "string" ? record.attributes.content.subject : "";
    return { templateId, subject };
  }
  const included = Array.isArray(root?.included) ? root.included : [];
  for (const item of included) {
    if (!item || typeof item !== "object") continue;
    const record = item as { type?: unknown; id?: unknown };
    if (record.type === "template" && typeof record.id === "string" && record.id) return { templateId: record.id, subject: "" };
  }
  return null;
}

export function parseTemplateHtml(body: unknown) {
  const data = body && typeof body === "object" ? (body as { data?: { attributes?: { html?: unknown } } }).data : null;
  return typeof data?.attributes?.html === "string" ? data.attributes.html : "";
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

export function parseMetricCatalog(body: unknown) {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : null;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { id?: unknown; attributes?: { name?: unknown; integration?: { name?: unknown } } };
    if (typeof record.id !== "string" || !record.id || typeof record.attributes?.name !== "string") return [];
    const integration = record.attributes.integration?.name;
    return [{ id: record.id, name: record.attributes.name, integration: typeof integration === "string" ? integration : "" }];
  });
}

export function choosePlacedOrder(metrics: { id: string; name: string; integration: string }[]) {
  const placed = metrics.filter((metric) => metric.name.toLowerCase() === "placed order");
  return placed.find((metric) => metric.integration === "Shopify")?.id ?? placed[0]?.id ?? null;
}

export function shopifyMetricsPath() {
  return `/api/metrics?filter=${encodeURIComponent('equals(integration.name,"Shopify")')}&fields[metric]=name,integration.name`;
}

export function campaignNamePath(channel: "email" | "sms" | "mobile_push") {
  return `/api/campaigns?fields[campaign]=name&filter=${encodeURIComponent(`equals(messages.channel,'${channel}')`)}`;
}

export function parseAccountCurrency(body: unknown) {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : null;
  const first = Array.isArray(data) ? data[0] : null;
  const currency = first && typeof first === "object" ? (first as { attributes?: { preferred_currency?: unknown } }).attributes?.preferred_currency : null;
  return typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : null;
}

export function retryWaitMs(header: string | null) {
  if (header === null || !header.trim()) return 2_000;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return 2_000;
  return Math.min(15_000, Math.round(seconds * 1000));
}

export type CampaignPerformance = {
  campaignId: string;
  recipients: number | null;
  delivered: number | null;
  opens: number | null;
  clicks: number | null;
  openRate: number | null;
  clickRate: number | null;
  revenuePence: number | null;
  orders: number | null;
  conversionRate: number | null;
  aovPence: number | null;
  unsubscribes: number | null;
  unsubscribeRate: number | null;
  bounces: number | null;
  bounceRate: number | null;
  spamComplaints: number | null;
  spamRate: number | null;
};

type PerformancePiece = {
  recipients: number | null;
  delivered: number | null;
  opens: number | null;
  opensUnique: number | null;
  openRate: number | null;
  clicks: number | null;
  clicksUnique: number | null;
  clickRate: number | null;
  conversionValue: number | null;
  conversions: number | null;
  conversionUniques: number | null;
  conversionRate: number | null;
  averageOrderValue: number | null;
  unsubscribes: number | null;
  unsubscribeRate: number | null;
  bounced: number | null;
  bounceRate: number | null;
  spamComplaints: number | null;
  spamRate: number | null;
};

function fraction(value: unknown) {
  const number = num(value);
  if (number === null || number < 0) return null;
  if (number > 1 && number <= 100) return number / 100;
  if (number > 100) return null;
  return number;
}

function pieceFromStats(stats: Record<string, unknown>): PerformancePiece {
  return {
    recipients: whole(stats.recipients),
    delivered: whole(stats.delivered),
    opens: whole(stats.opens),
    opensUnique: whole(stats.opens_unique),
    openRate: fraction(stats.open_rate),
    clicks: whole(stats.clicks),
    clicksUnique: whole(stats.clicks_unique),
    clickRate: fraction(stats.click_rate),
    conversionValue: num(stats.conversion_value),
    conversions: whole(stats.conversions),
    conversionUniques: whole(stats.conversion_uniques),
    conversionRate: fraction(stats.conversion_rate),
    averageOrderValue: num(stats.average_order_value),
    unsubscribes: whole(stats.unsubscribes),
    unsubscribeRate: fraction(stats.unsubscribe_rate),
    bounced: whole(stats.bounced),
    bounceRate: fraction(stats.bounce_rate),
    spamComplaints: whole(stats.spam_complaints),
    spamRate: fraction(stats.spam_complaint_rate),
  };
}

function sumPieces(rows: PerformancePiece[], key: keyof PerformancePiece) {
  let total = 0;
  let saw = false;
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "number") continue;
    total += value;
    saw = true;
  }
  return saw ? total : null;
}

function weightedRate(rows: PerformancePiece[], rate: keyof PerformancePiece, weight: keyof PerformancePiece) {
  let seen = 0;
  let acc = 0;
  for (const row of rows) {
    const value = row[rate];
    const basis = row[weight] ?? row.recipients;
    if (typeof value !== "number" || typeof basis !== "number" || basis <= 0) continue;
    acc += value * basis;
    seen += basis;
  }
  if (seen <= 0) return null;
  return acc / seen;
}

function penceFromMajor(value: number | null) {
  if (value === null) return null;
  return toPence(value.toFixed(4));
}

export function parseCampaignPerformance(body: unknown): CampaignPerformance[] {
  const data = body && typeof body === "object" ? (body as { data?: { attributes?: { results?: unknown } } }).data : null;
  const results = data?.attributes?.results;
  if (!Array.isArray(results)) return [];
  const grouped = new Map<string, PerformancePiece[]>();
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const record = result as { groupings?: unknown; statistics?: Record<string, unknown> };
    const campaignId = groupingId(record.groupings, ["campaign_id"]);
    if (!campaignId) continue;
    const pieces = grouped.get(campaignId) ?? [];
    pieces.push(pieceFromStats(record.statistics ?? {}));
    grouped.set(campaignId, pieces);
  }
  return [...grouped.entries()].map(([campaignId, pieces]) => {
    const delivered = sumPieces(pieces, "delivered");
    const recipients = sumPieces(pieces, "recipients");
    const uniqueOpens = sumPieces(pieces, "opensUnique");
    const uniqueClicks = sumPieces(pieces, "clicksUnique");
    const opens = uniqueOpens ?? sumPieces(pieces, "opens");
    const clicks = uniqueClicks ?? sumPieces(pieces, "clicks");
    const conversions = sumPieces(pieces, "conversions");
    const conversionUniques = sumPieces(pieces, "conversionUniques");
    const orders = conversions ?? conversionUniques;
    let revenuePence: number | null = null;
    if (pieces.some((piece) => piece.conversionValue !== null)) {
      revenuePence = pieces.reduce((sum, piece) => sum + (penceFromMajor(piece.conversionValue) ?? 0), 0);
    }
    const openRate = weightedRate(pieces, "openRate", "delivered") ?? rateFromCounts(opens, delivered);
    const clickRate = weightedRate(pieces, "clickRate", "delivered") ?? rateFromCounts(clicks, delivered);
    const aovFromRevenue = revenuePence !== null && orders !== null && orders > 0 ? Math.round(revenuePence / orders) : null;
    const aovWeighted = weightedRate(pieces, "averageOrderValue", "conversions");
    return {
      campaignId,
      recipients,
      delivered,
      opens,
      clicks,
      openRate,
      clickRate,
      revenuePence,
      orders,
      conversionRate: weightedRate(pieces, "conversionRate", "delivered") ?? rateFromCounts(orders, delivered ?? recipients),
      aovPence: aovFromRevenue ?? (aovWeighted === null ? null : penceFromMajor(aovWeighted)),
      unsubscribes: sumPieces(pieces, "unsubscribes"),
      unsubscribeRate: weightedRate(pieces, "unsubscribeRate", "delivered") ?? rateFromCounts(sumPieces(pieces, "unsubscribes"), delivered),
      bounces: sumPieces(pieces, "bounced"),
      bounceRate: weightedRate(pieces, "bounceRate", "recipients") ?? rateFromCounts(sumPieces(pieces, "bounced"), recipients),
      spamComplaints: sumPieces(pieces, "spamComplaints"),
      spamRate: weightedRate(pieces, "spamRate", "delivered") ?? rateFromCounts(sumPieces(pieces, "spamComplaints"), delivered),
    };
  });
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
