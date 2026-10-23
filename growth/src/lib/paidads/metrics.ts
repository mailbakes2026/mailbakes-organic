import { addDays, eachDate, mondayOf } from "@/lib/dates";

export const WEEKLY_GROWTH_TARGET = 0.05;

export type Fact = {
  platform: string;
  level: string;
  date: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  spendPence: number;
  revenuePence: number;
  orders: number;
  impressions: number | null;
  clicks: number | null;
  currency: string;
  source: string;
};

export type Totals = {
  spendPence: number;
  revenuePence: number;
  orders: number;
  impressions: number | null;
  clicks: number | null;
  currency: string;
  days: number;
};

export function currenciesOf(rows: { currency: string }[]) {
  return [...new Set(rows.map((row) => row.currency).filter(Boolean))];
}

export function sumFacts(rows: Fact[]): Totals | null {
  if (rows.length === 0) return null;
  const currencies = currenciesOf(rows);
  if (currencies.length !== 1) return null;
  let impressions: number | null = null;
  let clicks: number | null = null;
  let seenImpression = false;
  let seenClick = false;
  const totals = rows.reduce(
    (sum, row) => {
      if (row.impressions !== null) {
        seenImpression = true;
        impressions = (impressions ?? 0) + row.impressions;
      }
      if (row.clicks !== null) {
        seenClick = true;
        clicks = (clicks ?? 0) + row.clicks;
      }
      return {
        spendPence: sum.spendPence + row.spendPence,
        revenuePence: sum.revenuePence + row.revenuePence,
        orders: sum.orders + row.orders,
      };
    },
    { spendPence: 0, revenuePence: 0, orders: 0 },
  );
  return {
    ...totals,
    impressions: seenImpression ? impressions : null,
    clicks: seenClick ? clicks : null,
    currency: currencies[0],
    days: new Set(rows.map((row) => row.date)).size,
  };
}

export function headlineLevel(rows: Fact[]) {
  if (rows.some((row) => row.level === "account")) return "account";
  if (rows.some((row) => row.level === "campaign")) return "campaign";
  if (rows.some((row) => row.level === "adset")) return "adset";
  return null;
}

export function rowsForLevel(rows: Fact[], level: string) {
  return rows.filter((row) => row.level === level);
}

export type Compare = {
  current: Totals | null;
  previous: Totals | null;
  revenueChange: number | null;
  spendChange: number | null;
  ordersChange: number | null;
  targetRevenuePence: number | null;
  ahead: boolean | null;
  reason: string | null;
};

function change(current: number, previous: number) {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function compareTotals(current: Totals | null, previous: Totals | null): Compare {
  if (!current || !previous) {
    return {
      current,
      previous,
      revenueChange: null,
      spendChange: null,
      ordersChange: null,
      targetRevenuePence: null,
      ahead: null,
      reason: !current && !previous ? "Neither week has rows." : !current ? "This week has no rows." : "The comparison week has no rows.",
    };
  }
  if (current.currency !== previous.currency) {
    return {
      current,
      previous,
      revenueChange: null,
      spendChange: null,
      ordersChange: null,
      targetRevenuePence: null,
      ahead: null,
      reason: `The weeks use ${current.currency} and ${previous.currency}, so they are not compared.`,
    };
  }
  const targetRevenuePence =
    previous.revenuePence > 0 ? Math.round(previous.revenuePence * (1 + WEEKLY_GROWTH_TARGET)) : null;
  return {
    current,
    previous,
    revenueChange: change(current.revenuePence, previous.revenuePence),
    spendChange: change(current.spendPence, previous.spendPence),
    ordersChange: change(current.orders, previous.orders),
    targetRevenuePence,
    ahead: targetRevenuePence === null ? null : current.revenuePence >= targetRevenuePence,
    reason:
      previous.revenuePence <= 0
        ? "The comparison week has no revenue, so the 5% target is not set."
        : null,
  };
}

export function windowFor(today: string, range: "7d" | "28d") {
  const days = range === "7d" ? 6 : 27;
  return { from: addDays(today, -days), to: today };
}

export function wowWindows(today: string) {
  const weekStart = mondayOf(today);
  const elapsed = eachDate(weekStart, today).length;
  const prevStart = addDays(weekStart, -7);
  const priorStart = addDays(weekStart, -14);
  return {
    thisPartial: { from: weekStart, to: today },
    prevPartial: { from: prevStart, to: addDays(prevStart, elapsed - 1) },
    lastFull: { from: prevStart, to: addDays(weekStart, -1) },
    priorFull: { from: priorStart, to: addDays(prevStart, -1) },
    elapsed,
  };
}

export type NamedTotals = Totals & {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
};

export function groupFacts(rows: Fact[], keyOf: (row: Fact) => { id: string; name: string }) {
  const groups = new Map<string, Fact[]>();
  const labels = new Map<string, { id: string; name: string; campaignId: string; campaignName: string }>();
  for (const row of rows) {
    const key = keyOf(row);
    const id = key.id || key.name;
    if (!id) continue;
    const list = groups.get(id) ?? [];
    list.push(row);
    groups.set(id, list);
    labels.set(id, {
      id,
      name: key.name || key.id,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
    });
  }
  const out: NamedTotals[] = [];
  for (const [id, list] of groups) {
    const totals = sumFacts(list);
    const label = labels.get(id);
    if (!totals || !label) continue;
    out.push({ ...totals, ...label });
  }
  out.sort((a, b) => b.spendPence - a.spendPence || a.name.localeCompare(b.name));
  return out;
}
