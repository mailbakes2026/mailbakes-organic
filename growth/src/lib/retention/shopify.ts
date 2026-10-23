import { addDays, londonToday } from "@/lib/dates";
import { parseShopifyOrders, shopHost, type ParsedOrder } from "@/lib/retention/shopify-parse";
import { scrub } from "@/lib/scrub";

const VERSION = "2025-10";
const PAGE_CAP = 30;

const QUERY = `query Orders($cursor: String, $search: String!) {
  orders(first: 100, after: $cursor, query: $search, sortKey: CREATED_AT, reverse: true) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      createdAt
      cancelledAt
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      customer { id }
    }
  }
}`;

let cache: { shop: string; token: string; expiresAt: number } | null = null;

export async function shopifyToken(shop: string, clientId: string, clientSecret: string) {
  if (cache && cache.shop === shop && cache.expiresAt > Date.now() + 60_000) return cache.token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Shopify did not issue a token (HTTP ${response.status}).`);
  }
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Shopify token response was not JSON.");
  }
  const token = parsed && typeof parsed === "object" && "access_token" in parsed && typeof (parsed as { access_token?: unknown }).access_token === "string"
    ? (parsed as { access_token: string }).access_token
    : "";
  const expiresIn = parsed && typeof parsed === "object" && typeof (parsed as { expires_in?: unknown }).expires_in === "number"
    ? (parsed as { expires_in: number }).expires_in
    : 3600;
  if (!token) throw new Error("Shopify token response did not include an access token.");
  cache = { shop, token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

export async function pullShopifyOrders(input: { shopDomain: string; clientId: string; clientSecret: string; now?: Date }) {
  const shop = shopHost(input.shopDomain);
  const token = await shopifyToken(shop, input.clientId, input.clientSecret);
  const since = addDays(londonToday(input.now ?? new Date()), -540);
  const search = `created_at:>=${since} status:any`;
  const orders: ParsedOrder[] = [];
  let cursor: string | null = null;
  let skipped = 0;
  let truncated = false;
  for (let page = 0; page < PAGE_CAP; page += 1) {
    const response = await fetch(`https://${shop}/admin/api/${VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query: QUERY, variables: { cursor, search } }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Shopify orders failed (HTTP ${response.status}).`);
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new Error("Shopify orders response was not JSON.");
    }
    let parsed: ReturnType<typeof parseShopifyOrders>;
    try {
      parsed = parseShopifyOrders(body);
    } catch (error) {
      throw new Error(scrub(error instanceof Error ? error.message : "Shopify returned an error."));
    }
    orders.push(...parsed.orders);
    skipped += parsed.skipped;
    if (!parsed.hasNextPage || !parsed.endCursor) {
      truncated = false;
      cursor = null;
      break;
    }
    cursor = parsed.endCursor;
    truncated = page === PAGE_CAP - 1;
  }
  return { shop, since, orders, skipped, truncated };
}
