import {
  campaignNamePath,
  choosePlacedOrder,
  klaviyoError,
  parseAccountCurrency,
  parseLists,
  parseMetricCatalog,
  parseNamedResources,
  parseValuesReport,
  retryWaitMs,
  safeKlaviyoNext,
  shopifyMetricsPath,
  type SendDraft,
} from "@/lib/retention/klaviyo-parse";
import { logSafe, scrub } from "@/lib/scrub";

const REVISION = "2025-04-15";
const BASE = "https://a.klaviyo.com";
const CAMPAIGN_CHANNELS = ["email", "sms", "mobile_push"] as const;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function klaviyo(path: string, key: string, init?: { method?: string; body?: unknown }) {
  let response: Response | null = null;
  let text = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
      signal: AbortSignal.timeout(20_000),
    });
    text = await response.text();
    if (response.status !== 429 || attempt === 1) break;
    await wait(retryWaitMs(response.headers.get("retry-after")));
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

async function collect(path: string, key: string) {
  const pages = [];
  let next: string | null = path;
  for (let page = 0; page < 10 && next; page += 1) {
    const body = await klaviyo(next, key);
    pages.push(body);
    const links = body && typeof body === "object" ? (body as { links?: { next?: unknown } }).links : null;
    next = safeKlaviyoNext(links?.next);
  }
  return pages;
}

export async function pullKlaviyo(key: string) {
  const metricId = await placedOrderId(key);
  if (!metricId) {
    throw new Error("Klaviyo is connected, but no metric named Placed Order was found, so flow and campaign revenue cannot be requested.");
  }
  const windows = [
    ["7d", "last_7_days"],
    ["30d", "last_30_days"],
  ] as const;
  const flows: SendDraft[] = [];
  const campaigns: SendDraft[] = [];
  for (const [window, timeframe] of windows) {
    const flowBody = await klaviyo("/api/flow-values-reports", key, {
      method: "POST",
      body: reportBody("flow-values-report", timeframe, metricId),
    });
    const campaignBody = await klaviyo("/api/campaign-values-reports", key, {
      method: "POST",
      body: reportBody("campaign-values-report", timeframe, metricId),
    });
    flows.push(...parseValuesReport(flowBody, window, ["flow_id"]));
    campaigns.push(...parseValuesReport(campaignBody, window, ["campaign_id"]));
  }
  const currency = (await accountCurrency(key)) ?? "GBP";
  for (const row of [...flows, ...campaigns]) {
    if (!/^[A-Z]{3}$/.test(row.currency)) row.currency = currency;
  }
  const flowNames = await names("/api/flows?fields[flow]=name", key);
  const campaignNames = await campaignNameMap(key);
  for (const flow of flows) flow.name = flowNames.get(flow.id) ?? flow.id;
  for (const campaign of campaigns) campaign.name = campaignNames.get(campaign.id) ?? campaign.id;
  const listed = await listsFor(key);
  return {
    flows,
    campaigns,
    lists: listed.lists,
    namesMissing: flows.some((flow) => flow.name === flow.id) || campaigns.some((campaign) => campaign.name === campaign.id),
    countsMissing: listed.countsMissing,
  };
}

async function placedOrderId(key: string) {
  try {
    const id = choosePlacedOrder((await collect(shopifyMetricsPath(), key)).flatMap(parseMetricCatalog));
    if (id) return id;
  } catch (error) {
    logSafe("klaviyo shopify metrics", error);
  }
  return choosePlacedOrder((await collect("/api/metrics?fields[metric]=name,integration.name", key)).flatMap(parseMetricCatalog));
}

async function accountCurrency(key: string) {
  try {
    return parseAccountCurrency(await klaviyo("/api/accounts", key));
  } catch (error) {
    logSafe("klaviyo account", error);
    return null;
  }
}

async function names(path: string, key: string) {
  try {
    return new Map((await collect(path, key)).flatMap(parseNamedResources).map((item) => [item.id, item.name]));
  } catch (error) {
    logSafe("klaviyo names", error);
    return new Map<string, string>();
  }
}

async function campaignNameMap(key: string) {
  const map = new Map<string, string>();
  for (const channel of CAMPAIGN_CHANNELS) {
    try {
      for (const item of (await collect(campaignNamePath(channel), key)).flatMap(parseNamedResources)) {
        map.set(item.id, item.name);
      }
    } catch (error) {
      logSafe("klaviyo campaign names", error);
    }
  }
  return map;
}

async function listsFor(key: string) {
  try {
    const lists = (await collect("/api/lists?fields[list]=name&additional-fields[list]=profile_count", key)).flatMap(parseLists);
    return { lists, countsMissing: lists.length > 0 && lists.every((list) => list.profiles === null) };
  } catch (error) {
    logSafe("klaviyo lists", error);
    const lists = (await collect("/api/lists?fields[list]=name", key)).flatMap(parseLists);
    return { lists, countsMissing: true };
  }
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
