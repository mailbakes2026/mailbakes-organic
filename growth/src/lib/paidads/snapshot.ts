import { addDays } from "@/lib/dates";
import { formatCount, formatMoney, formatRoas } from "@/lib/format";
import { headlineLevel, rowsForLevel, sumFacts, type Fact } from "@/lib/paidads/metrics";

export const AD_MIN_SPEND_PENCE = 5_000;

export type ShopifyOrderFact = {
  customerId: string;
  orderedOn: string;
  totalPence: number;
  currency: string;
};

export type MetaAudience = {
  newLabel: string;
  returningLabel: string;
  newCustomers: number | null;
  returningCustomers: number | null;
  note: string | null;
};

export type MetaWindow = {
  key: "today" | "yesterday" | "seven";
  label: string;
  partial: boolean;
  from: string;
  to: string;
  spendPence: number | null;
  currency: string | null;
  spendLabel: string;
  purchases: number | null;
  purchasesLabel: string;
  roasLabel: string;
  merLabel: string;
  shopifyRevenuePence: number | null;
  shopifyLabel: string;
  note: string | null;
  audience: MetaAudience;
};

export type RankedAd = {
  id: string;
  name: string;
  campaignName: string;
  adsetName: string;
  spendPence: number;
  revenuePence: number;
  purchases: number;
  currency: string;
  roas: number;
  roasLabel: string;
};

export type MetaSnapshot = {
  hasMeta: boolean;
  windows: MetaWindow[];
  top: RankedAd[];
  bottom: RankedAd[];
  rankedCount: number;
  belowMinimum: number;
  adNote: string | null;
};

type ShopifySlice = {
  revenuePence: number | null;
  currency: string | null;
  note: string | null;
  audience: MetaAudience;
};

function blankAudience(note: string | null): MetaAudience {
  return { newLabel: "—", returningLabel: "—", newCustomers: null, returningCustomers: null, note };
}

function peopleLabel(pence: number, customers: number, currency: string) {
  const people = customers === 1 ? "1 customer" : `${formatCount(customers)} customers`;
  return `${formatMoney(pence, currency)} · ${people}`;
}

function soleCurrency(orders: ShopifyOrderFact[]) {
  const currencies = [...new Set(orders.map((order) => order.currency).filter(Boolean))];
  return currencies.length === 1 ? currencies[0] : null;
}

function shopifySlice(orders: ShopifyOrderFact[], from: string, to: string): ShopifySlice {
  if (orders.length === 0) {
    return { revenuePence: null, currency: null, note: "No Shopify orders are stored.", audience: blankAudience("No Shopify orders are stored.") };
  }
  const inWindow = orders.filter((order) => order.orderedOn >= from && order.orderedOn <= to);
  if (inWindow.length === 0) {
    const currency = soleCurrency(orders);
    if (!currency) {
      const note = "Shopify orders use more than one currency, so they are not added together.";
      return { revenuePence: null, currency: null, note, audience: blankAudience(note) };
    }
    return {
      revenuePence: 0,
      currency,
      note: null,
      audience: {
        newLabel: peopleLabel(0, 0, currency),
        returningLabel: peopleLabel(0, 0, currency),
        newCustomers: 0,
        returningCustomers: 0,
        note: null,
      },
    };
  }
  const currencies = [...new Set(inWindow.map((order) => order.currency).filter(Boolean))];
  if (currencies.length !== 1) {
    const note = `Shopify orders use ${currencies.join(" and ")}, so they are not added together.`;
    return { revenuePence: null, currency: null, note, audience: blankAudience(note) };
  }
  const currency = currencies[0]!;
  const first = new Map<string, string>();
  for (const order of orders) {
    if (!order.customerId) continue;
    const prev = first.get(order.customerId);
    if (!prev || order.orderedOn < prev) first.set(order.customerId, order.orderedOn);
  }
  const fresh = new Set<string>();
  const returning = new Set<string>();
  let newRevenue = 0;
  let returningRevenue = 0;
  let guestOrders = 0;
  for (const order of inWindow) {
    if (!order.customerId) {
      guestOrders += 1;
      continue;
    }
    const start = first.get(order.customerId);
    if (start && start < from) {
      returning.add(order.customerId);
      returningRevenue += order.totalPence;
    } else {
      fresh.add(order.customerId);
      newRevenue += order.totalPence;
    }
  }
  const guestNote =
    guestOrders === 0 ? null : guestOrders === 1 ? "1 guest order is not in the new or returning split." : `${formatCount(guestOrders)} guest orders are not in the new or returning split.`;
  return {
    revenuePence: inWindow.reduce((sum, order) => sum + order.totalPence, 0),
    currency,
    note: guestNote,
    audience: {
      newLabel: peopleLabel(newRevenue, fresh.size, currency),
      returningLabel: peopleLabel(returningRevenue, returning.size, currency),
      newCustomers: fresh.size,
      returningCustomers: returning.size,
      note: guestNote,
    },
  };
}

function metaTotals(rows: Fact[], from: string, to: string) {
  const ranged = rows.filter((row) => row.platform === "meta" && row.date >= from && row.date <= to && row.level !== "ad");
  const level = headlineLevel(ranged);
  if (!level) return null;
  return sumFacts(rowsForLevel(ranged, level));
}

function windowView(
  key: MetaWindow["key"],
  label: string,
  partial: boolean,
  from: string,
  to: string,
  rows: Fact[],
  orders: ShopifyOrderFact[],
): MetaWindow {
  const totals = metaTotals(rows, from, to);
  const shop = shopifySlice(orders, from, to);
  const notes: string[] = [];
  if (!totals) notes.push(key === "seven" ? "No Meta rows in these 7 days." : "No Meta row for this day.");
  if (totals && shop.revenuePence !== null && shop.currency && totals.currency !== shop.currency) {
    notes.push(`Meta is ${totals.currency} and Shopify is ${shop.currency}, so MER is not shown.`);
  }
  if (shop.note && shop.note !== "No Shopify orders are stored.") notes.push(shop.note);
  else if (!totals && shop.note) notes.push(shop.note);
  else if (totals && shop.revenuePence === null && shop.note) notes.push(shop.note);
  const merLabel =
    totals && totals.spendPence > 0 && shop.revenuePence !== null && (!shop.currency || shop.currency === totals.currency)
      ? (formatRoas(shop.revenuePence, totals.spendPence) ?? "—")
      : "—";
  return {
    key,
    label,
    partial,
    from,
    to,
    spendPence: totals ? totals.spendPence : null,
    currency: totals?.currency ?? null,
    spendLabel: totals ? formatMoney(totals.spendPence, totals.currency) : "—",
    purchases: totals ? totals.orders : null,
    purchasesLabel: totals ? (formatCount(totals.orders) ?? "—") : "—",
    roasLabel: totals ? (formatRoas(totals.revenuePence, totals.spendPence) ?? "—") : "—",
    merLabel,
    shopifyRevenuePence: shop.revenuePence,
    shopifyLabel: shop.revenuePence !== null && shop.currency ? formatMoney(shop.revenuePence, shop.currency) : "—",
    note: notes[0] ?? null,
    audience: shop.audience,
  };
}

function lastName(rows: Fact[], pick: (row: Fact) => string) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = pick(rows[index]!);
    if (value) return value;
  }
  return "";
}

function rankAds(rows: Fact[], from: string, to: string) {
  const ads = rows.filter((row) => row.platform === "meta" && row.level === "ad" && row.date >= from && row.date <= to);
  const groups = new Map<string, Fact[]>();
  for (const row of ads) {
    const id = row.adId || row.adName;
    if (!id) continue;
    const list = groups.get(id) ?? [];
    list.push(row);
    groups.set(id, list);
  }
  let belowMinimum = 0;
  let otherCurrency = 0;
  const ranked: RankedAd[] = [];
  for (const [id, list] of groups) {
    const totals = sumFacts(list);
    if (!totals) continue;
    if (totals.currency !== "GBP") {
      otherCurrency += 1;
      continue;
    }
    if (totals.spendPence < AD_MIN_SPEND_PENCE) {
      belowMinimum += 1;
      continue;
    }
    ranked.push({
      id,
      name: lastName(list, (row) => row.adName) || id,
      campaignName: lastName(list, (row) => row.campaignName),
      adsetName: lastName(list, (row) => row.adsetName),
      spendPence: totals.spendPence,
      revenuePence: totals.revenuePence,
      purchases: totals.orders,
      currency: totals.currency,
      roas: totals.revenuePence / totals.spendPence,
      roasLabel: formatRoas(totals.revenuePence, totals.spendPence) ?? "—",
    });
  }
  ranked.sort((a, b) => b.roas - a.roas || b.spendPence - a.spendPence || a.name.localeCompare(b.name, "en-GB"));
  const top = ranked.slice(0, 5);
  const topIds = new Set(top.map((ad) => ad.id));
  const bottom = ranked
    .filter((ad) => !topIds.has(ad.id))
    .sort((a, b) => a.roas - b.roas || b.spendPence - a.spendPence || a.name.localeCompare(b.name, "en-GB"))
    .slice(0, 5);
  let adNote: string | null = null;
  if (ads.length === 0) adNote = "No ad rows are stored for these 7 days.";
  else if (ranked.length === 0) adNote = "No ad has £50 of spend in these 7 days.";
  else if (bottom.length === 0) adNote = "Fewer than six ads have £50 of spend, so there is no separate bottom five.";
  if (otherCurrency) {
    const extra = "Ads in another currency are not ranked against £50.";
    adNote = adNote ? `${adNote} ${extra}` : extra;
  }
  return { top, bottom, rankedCount: ranked.length, belowMinimum, adNote };
}

export function buildMetaSnapshot(input: { rows: Fact[]; orders: ShopifyOrderFact[]; today: string }): MetaSnapshot {
  const yesterday = addDays(input.today, -1);
  const sevenFrom = addDays(input.today, -6);
  const windows = [
    windowView("today", "Today", true, input.today, input.today, input.rows, input.orders),
    windowView("yesterday", "Yesterday", false, yesterday, yesterday, input.rows, input.orders),
    windowView("seven", "Last 7 days", true, sevenFrom, input.today, input.rows, input.orders),
  ];
  const ranks = rankAds(input.rows, sevenFrom, input.today);
  return {
    hasMeta: windows.some((window) => window.spendPence !== null),
    windows,
    ...ranks,
  };
}
