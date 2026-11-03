import { metaErrorMessage, normaliseAccount, parseInsightsPage, safeGraphNext, type MetaLevel, type ParsedInsight } from "@/lib/paidads/meta-parse";
import { scrub } from "@/lib/scrub";

const VERSION = "v25.0";
const LEVELS: MetaLevel[] = ["account", "campaign", "adset", "ad"];

const FIELDS: Record<MetaLevel, string> = {
  account: "spend,impressions,clicks,actions,action_values,account_currency",
  campaign: "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,account_currency",
  adset: "campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,actions,action_values,account_currency",
  ad: "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions,action_values,account_currency",
};

async function graph(url: string, token: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    throw new Error(scrub(error instanceof Error ? error.message : "Meta insights failed."));
  }
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

async function pullLevel(
  account: string,
  level: MetaLevel,
  input: { since: string; until: string; token: string },
) {
  const params = new URLSearchParams({
    level,
    time_increment: "1",
    time_range: JSON.stringify({ since: input.since, until: input.until }),
    fields: FIELDS[level],
    use_account_attribution_setting: "true",
    limit: "500",
  });
  const rows: ParsedInsight[] = [];
  let next: string | null = `https://graph.facebook.com/${VERSION}/${account}/insights?${params}`;
  let truncated = false;
  for (let page = 0; page < 20 && next; page += 1) {
    const body = await graph(next, input.token);
    const parsed = parseInsightsPage(body, level);
    rows.push(...parsed.rows);
    const following = safeGraphNext(parsed.next);
    if (parsed.next && !following) break;
    if (page === 19 && following) {
      truncated = true;
      next = null;
      break;
    }
    next = following;
  }
  return { rows, truncated };
}

export async function pullMetaInsights(input: { since: string; until: string; token: string; accountId: string }) {
  const account = normaliseAccount(input.accountId);
  const rows: ParsedInsight[] = [];
  const notes: string[] = [];
  for (const level of LEVELS) {
    try {
      const pulled = await pullLevel(account, level, input);
      rows.push(...pulled.rows);
      if (pulled.truncated) notes.push(`Meta ${level} paging stopped early, so some of those rows were not stored.`);
    } catch (error) {
      const message = scrub(error instanceof Error ? error.message : "Meta insights failed.");
      if (level === "ad") {
        notes.push(`Ad rows were not stored. ${message}`);
        continue;
      }
      throw new Error(message);
    }
  }
  return { rows, notes };
}
