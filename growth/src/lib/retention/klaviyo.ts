import {
  campaignNamePath,
  choosePlacedOrder,
  klaviyoError,
  parseAccountCurrency,
  parseCampaignPerformance,
  parseLists,
  parseMetricCatalog,
  parseNamedResources,
  parseValuesReport,
  retryWaitMs,
  safeKlaviyoNext,
  shopifyMetricsPath,
} from "@/lib/retention/klaviyo-parse";
import { mergeSignals } from "@/lib/deadline";
import { logSafe, scrub } from "@/lib/scrub";

const REVISION = "2025-04-15";
const BASE = "https://a.klaviyo.com";
const CAMPAIGN_CHANNELS = ["email", "sms", "mobile_push"] as const;
const REQUEST_MS = 8_000;
const PULL_MS = 18_000;

function wait(ms: number, signal?: AbortSignal) {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason instanceof Error ? signal.reason : new Error("Klaviyo took too long."));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function klaviyo(path: string, key: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }) {
  let response: Response | null = null;
  let text = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (init?.signal?.aborted) throw init.signal.reason instanceof Error ? init.signal.reason : new Error("Klaviyo took too long.");
    response = await fetch(`${BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Klaviyo-API-Key ${key}`,
        revision: REVISION,
        accept: "application/vnd.api+json",
        "content-type": "application/vnd.api+json",
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: mergeSignals(init?.signal, REQUEST_MS),
    });
    text = await response.text();
    if (response.status !== 429 || attempt === 1) break;
    await wait(retryWaitMs(response.headers.get("retry-after")), init?.signal);
  }
  if (!response) throw new Error("Klaviyo request failed.");
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Klaviyo returned a non-JSON response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const detail =
      response.status === 429
        ? "Klaviyo asked Retention to slow down. Wait a minute, then sync again."
        : klaviyoError(body) || `Klaviyo request failed (HTTP ${response.status}).`;
    throw new Error(scrub(detail));
  }
  return body;
}

async function collect(path: string, key: string, signal?: AbortSignal) {
  const pages = [];
  let next: string | null = path;
  for (let page = 0; page < 10 && next; page += 1) {
    const body = await klaviyo(next, key, { signal });
    pages.push(body);
    const links = body && typeof body === "object" ? (body as { links?: { next?: unknown } }).links : null;
    next = safeKlaviyoNext(links?.next);
  }
  return pages;
}

export async function pullKlaviyo(key: string) {
  const signal = AbortSignal.timeout(PULL_MS);
  const metricId = await placedOrderId(key, signal);
  if (!metricId) {
    throw new Error("Klaviyo is connected, but no metric named Placed Order was found, so flow and campaign revenue cannot be requested.");
  }
  const [flow7, campaign7, flow30, campaign30, currencyCode, flowNames, campaignNames, listed] = await Promise.all([
    klaviyo("/api/flow-values-reports", key, { method: "POST", body: reportBody("flow-values-report", "last_7_days", metricId), signal }),
    klaviyo("/api/campaign-values-reports", key, { method: "POST", body: reportBody("campaign-values-report", "last_7_days", metricId), signal }),
    klaviyo("/api/flow-values-reports", key, { method: "POST", body: reportBody("flow-values-report", "last_30_days", metricId), signal }),
    klaviyo("/api/campaign-values-reports", key, { method: "POST", body: reportBody("campaign-values-report", "last_30_days", metricId), signal }),
    accountCurrency(key, signal),
    names("/api/flows?fields[flow]=name", key, signal),
    campaignNameMap(key, signal),
    listsFor(key, signal),
  ]);
  const flows = [...parseValuesReport(flow7, "7d", ["flow_id"]), ...parseValuesReport(flow30, "30d", ["flow_id"])];
  const campaigns = [...parseValuesReport(campaign7, "7d", ["campaign_id"]), ...parseValuesReport(campaign30, "30d", ["campaign_id"])];
  const currency = currencyCode ?? "GBP";
  for (const row of [...flows, ...campaigns]) {
    if (!/^[A-Z]{3}$/.test(row.currency)) row.currency = currency;
  }
  for (const flow of flows) flow.name = flowNames.get(flow.id) ?? flow.id;
  for (const campaign of campaigns) campaign.name = campaignNames.get(campaign.id) ?? campaign.id;
  return {
    flows,
    campaigns,
    lists: listed.lists,
    namesMissing: flows.some((flow) => flow.name === flow.id) || campaigns.some((campaign) => campaign.name === campaign.id),
    countsMissing: listed.countsMissing,
  };
}

async function placedOrderId(key: string, signal: AbortSignal) {
  const shopifyTry = collect(shopifyMetricsPath(), key, signal)
    .then((pages) => ({ ok: true as const, id: choosePlacedOrder(pages.flatMap(parseMetricCatalog)) }))
    .catch((error: unknown) => {
      logSafe("klaviyo shopify metrics", error);
      return { ok: false as const, error };
    });
  const catalogTry = collect("/api/metrics?fields[metric]=name,integration.name", key, signal)
    .then((pages) => ({ ok: true as const, id: choosePlacedOrder(pages.flatMap(parseMetricCatalog)) }))
    .catch((error: unknown) => ({ ok: false as const, error }));
  const [shopify, catalog] = await Promise.all([shopifyTry, catalogTry]);
  if (shopify.ok && shopify.id) return shopify.id;
  if (catalog.ok && catalog.id) return catalog.id;
  if (catalog.ok && shopify.ok) return null;
  if (!catalog.ok) throw catalog.error;
  throw shopify.ok ? new Error("Klaviyo metrics could not be read.") : shopify.error;
}

async function accountCurrency(key: string, signal?: AbortSignal) {
  try {
    return parseAccountCurrency(await klaviyo("/api/accounts", key, { signal }));
  } catch (error) {
    logSafe("klaviyo account", error);
    return null;
  }
}

async function names(path: string, key: string, signal?: AbortSignal) {
  try {
    return new Map((await collect(path, key, signal)).flatMap(parseNamedResources).map((item) => [item.id, item.name]));
  } catch (error) {
    logSafe("klaviyo names", error);
    return new Map<string, string>();
  }
}

async function campaignNameMap(key: string, signal?: AbortSignal) {
  const lists = await Promise.all(
    CAMPAIGN_CHANNELS.map(async (channel) => {
      try {
        return (await collect(campaignNamePath(channel), key, signal)).flatMap(parseNamedResources);
      } catch (error) {
        logSafe("klaviyo campaign names", error);
        return [];
      }
    }),
  );
  return new Map(lists.flat().map((item) => [item.id, item.name]));
}

async function listsFor(key: string, signal?: AbortSignal) {
  try {
    const lists = (await collect("/api/lists?fields[list]=name&additional-fields[list]=profile_count", key, signal)).flatMap(parseLists);
    return { lists, countsMissing: lists.length > 0 && lists.every((list) => list.profiles === null) };
  } catch (error) {
    logSafe("klaviyo lists", error);
    const lists = (await collect("/api/lists?fields[list]=name", key, signal)).flatMap(parseLists);
    return { lists, countsMissing: true };
  }
}

const CAMPAIGN_STATS = [
  "recipients",
  "delivered",
  "opens",
  "opens_unique",
  "open_rate",
  "clicks",
  "clicks_unique",
  "click_rate",
  "conversion_value",
  "conversions",
  "conversion_uniques",
  "conversion_rate",
  "average_order_value",
  "unsubscribes",
  "unsubscribe_rate",
  "bounced",
  "bounce_rate",
  "spam_complaints",
  "spam_complaint_rate",
];

const CAMPAIGN_STATS_SAFE = ["opens", "clicks", "unsubscribes", "delivered", "recipients", "conversion_value"];

export type CampaignTimeframe = { key: "last_12_months" } | { start: string; end: string };

export async function pullCampaignPerformance(key: string, campaignIds: string[], timeframe: CampaignTimeframe) {
  const ids = [...new Set(campaignIds.filter((id) => /^[A-Za-z0-9]{6,32}$/.test(id)))];
  if (!ids.length) return { currency: "GBP", rows: [] };
  const signal = AbortSignal.timeout(PULL_MS);
  const metricId = await placedOrderId(key, signal);
  if (!metricId) {
    throw new Error("Klaviyo is connected, but no metric named Placed Order was found, so campaign revenue cannot be requested.");
  }
  const filter = ids.length === 1 ? `equals(campaign_id,"${ids[0]}")` : `contains-any(campaign_id,[${ids.map((id) => `"${id}"`).join(",")}])`;
  const currencyPromise = accountCurrency(key, signal);
  let body: unknown;
  try {
    body = await campaignReport(key, CAMPAIGN_STATS, timeframe, metricId, filter, signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/statistic/i.test(message)) throw error;
    body = await campaignReport(key, CAMPAIGN_STATS_SAFE, timeframe, metricId, filter, signal);
  }
  const currency = (await currencyPromise) ?? "GBP";
  return { currency, rows: parseCampaignPerformance(body) };
}

async function campaignReport(
  key: string,
  statistics: string[],
  timeframe: CampaignTimeframe,
  conversionMetricId: string,
  filter: string,
  signal?: AbortSignal,
) {
  return klaviyo("/api/campaign-values-reports", key, {
    method: "POST",
    body: {
      data: {
        type: "campaign-values-report",
        attributes: {
          statistics,
          timeframe,
          conversion_metric_id: conversionMetricId,
          filter,
        },
      },
    },
    signal,
  });
}

function reportBody(type: string, timeframe: string, conversionMetricId: string) {
  return {
    data: {
      type,
      attributes: {
        statistics: ["opens", "clicks", "unsubscribes", "delivered", "recipients", "conversion_value"],
        timeframe: { key: timeframe },
        conversion_metric_id: conversionMetricId,
      },
    },
  };
}
