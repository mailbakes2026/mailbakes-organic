import {
  klaviyoError,
  parseLists,
  parseNamedResources,
  parsePlacedOrderMetric,
  parseValuesReport,
  safeKlaviyoNext,
  type SendDraft,
} from "@/lib/retention/klaviyo-parse";
import { logSafe, scrub } from "@/lib/scrub";

const REVISION = "2025-04-15";
const BASE = "https://a.klaviyo.com";

async function klaviyo(path: string, key: string, init?: { method?: string; body?: unknown }) {
  const response = await fetch(`${BASE}${path}`, {
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
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Klaviyo returned a non-JSON response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(scrub(klaviyoError(body) || `Klaviyo request failed (HTTP ${response.status}).`));
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
  const metricPages = await collect("/api/metrics", key);
  const metricId = metricPages.map(parsePlacedOrderMetric).find(Boolean) ?? null;
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
  const flowNames = await names("/api/flows?fields[flow]=name", key);
  const campaignNames = await names("/api/campaigns?fields[campaign]=name", key);
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

async function names(path: string, key: string) {
  try {
    return new Map((await collect(path, key)).flatMap(parseNamedResources).map((item) => [item.id, item.name]));
  } catch (error) {
    logSafe("klaviyo names", error);
    return new Map<string, string>();
  }
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
