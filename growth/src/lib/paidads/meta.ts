import { metaErrorMessage, normaliseAccount, parseInsightsPage, safeGraphNext, type MetaLevel, type ParsedInsight } from "@/lib/paidads/meta-parse";
import { scrub } from "@/lib/scrub";

const VERSION = "v21.0";

async function graph(url: string, token: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Meta returned a non-JSON response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(scrub(metaErrorMessage(body) || `Meta insights failed (HTTP ${response.status}).`));
  }
  return body;
}

export async function pullMetaInsights(input: { since: string; until: string; token: string; accountId: string }) {
  const account = normaliseAccount(input.accountId);
  const rows: ParsedInsight[] = [];
  const levels: MetaLevel[] = ["account", "campaign", "adset"];
  for (const level of levels) {
    const fields =
      level === "account"
        ? "spend,impressions,clicks,actions,action_values,account_currency"
        : level === "campaign"
          ? "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,account_currency"
          : "campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,actions,action_values,account_currency";
    const params = new URLSearchParams({
      level,
      time_increment: "1",
      time_range: JSON.stringify({ since: input.since, until: input.until }),
      fields,
      limit: "200",
    });
    let next: string | null = `https://graph.facebook.com/${VERSION}/${account}/insights?${params}`;
    for (let page = 0; page < 25 && next; page += 1) {
      const body = await graph(next, input.token);
      const parsed = parseInsightsPage(body, level);
      rows.push(...parsed.rows);
      next = safeGraphNext(parsed.next);
    }
  }
  return rows;
}
