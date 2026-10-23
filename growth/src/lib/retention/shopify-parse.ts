import { londonToday } from "@/lib/dates";
import { toPence } from "@/lib/money";

export type ParsedOrder = {
  id: string;
  customerId: string;
  orderedOn: string;
  totalPence: number;
  currency: string;
  source: "shopify";
  guest: boolean;
};

export function shopHost(value: string) {
  const host = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host)) {
    throw new Error("SHOPIFY_SHOP must be the shop's myshopify.com domain.");
  }
  return host;
}

export function parseShopifyOrders(body: unknown) {
  const data = body && typeof body === "object" ? (body as { data?: { orders?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: unknown[] } }; errors?: { message?: string }[] }).data : null;
  const errors = body && typeof body === "object" && "errors" in body ? (body as { errors?: { message?: string }[] }).errors : null;
  if (errors?.length) {
    throw new Error(errors.find((error) => error.message)?.message || "Shopify returned an error.");
  }
  const orders = data?.orders;
  const nodes = Array.isArray(orders?.nodes) ? orders.nodes : [];
  const parsed: ParsedOrder[] = [];
  let skipped = 0;
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      skipped += 1;
      continue;
    }
    const record = node as {
      id?: unknown;
      createdAt?: unknown;
      cancelledAt?: unknown;
      currentTotalPriceSet?: { shopMoney?: { amount?: unknown; currencyCode?: unknown } };
      customer?: { id?: unknown } | null;
    };
    if (record.cancelledAt) continue;
    const id = typeof record.id === "string" ? record.id : "";
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
    const orderedOn = createdAt ? londonDate(createdAt) : "";
    const amount = record.currentTotalPriceSet?.shopMoney?.amount;
    const currency = typeof record.currentTotalPriceSet?.shopMoney?.currencyCode === "string" ? record.currentTotalPriceSet.shopMoney.currencyCode : "";
    const total = toPence(typeof amount === "number" ? String(amount) : amount);
    if (!id || !orderedOn || total === null || !/^[A-Z]{3}$/.test(currency)) {
      skipped += 1;
      continue;
    }
    const customerId = typeof record.customer?.id === "string" ? record.customer.id : "";
    parsed.push({ id, customerId, orderedOn, totalPence: total, currency, source: "shopify", guest: !customerId });
  }
  return {
    orders: parsed,
    skipped,
    hasNextPage: Boolean(orders?.pageInfo?.hasNextPage),
    endCursor: typeof orders?.pageInfo?.endCursor === "string" ? orders.pageInfo.endCursor : null,
  };
}

function londonDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return londonToday(date);
}
