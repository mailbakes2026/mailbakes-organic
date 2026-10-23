import { addDays, eachDate, formatDay, mondayOf } from "@/lib/dates";
import { formatChange, formatCpa, formatMoney, formatRoas } from "@/lib/format";
import {
  compareTotals,
  currenciesOf,
  groupFacts,
  headlineLevel,
  rowsForLevel,
  sumFacts,
  windowFor,
  wowWindows,
  type Fact,
} from "@/lib/paidads/metrics";

export type PaidView = ReturnType<typeof buildPaidView>;

function inWindow(rows: Fact[], from: string, to: string) {
  return rows.filter((row) => row.date >= from && row.date <= to);
}

function levelLabel(level: string | null) {
  if (level === "account") return "Account rows";
  if (level === "campaign") return "Campaign rows, added together. No account row is stored.";
  if (level === "adset") return "Ad set rows, added together. No account or campaign row is stored.";
  return "";
}

export function buildPaidView(input: {
  rows: Fact[];
  today: string;
  range: "7d" | "28d";
  metaConnected: boolean;
  googleRows: number;
}) {
  const metaRows = input.rows.filter((row) => row.platform === "meta");
  const googleOnly = metaRows.length === 0;
  const primary = googleOnly ? input.rows.filter((row) => row.platform === "google") : metaRows;
  const bothPlatforms = metaRows.length > 0 && input.rows.some((row) => row.platform === "google");
  const rangeWindow = windowFor(input.today, input.range);
  const ranged = inWindow(primary, rangeWindow.from, rangeWindow.to);
  const level = headlineLevel(ranged);
  const headlineRows = level ? rowsForLevel(ranged, level) : [];
  const currencies = currenciesOf(headlineRows);
  const headline = currencies.length > 1 ? null : sumFacts(headlineRows);
  const weeks = weekRows(primary, input.today);
  const wow = wowWindows(input.today);
  const partialLevel = headlineLevel([
    ...inWindow(primary, wow.thisPartial.from, wow.thisPartial.to),
    ...inWindow(primary, wow.prevPartial.from, wow.prevPartial.to),
  ]);
  const partial = compareTotals(
    sumWindow(primary, partialLevel, wow.thisPartial.from, wow.thisPartial.to),
    sumWindow(primary, partialLevel, wow.prevPartial.from, wow.prevPartial.to),
  );
  const fullLevel = headlineLevel([
    ...inWindow(primary, wow.lastFull.from, wow.lastFull.to),
    ...inWindow(primary, wow.priorFull.from, wow.priorFull.to),
  ]);
  const full = compareTotals(
    sumWindow(primary, fullLevel, wow.lastFull.from, wow.lastFull.to),
    sumWindow(primary, fullLevel, wow.priorFull.from, wow.priorFull.to),
  );
  const breakdown = inWindow(input.rows, rangeWindow.from, rangeWindow.to);
  const campaignRows = rowsForLevel(breakdown, "campaign");
  const adsetRows = rowsForLevel(breakdown, "adset");
  const campaignBasis = campaignRows.length ? "campaign" : adsetRows.length ? "adset" : null;
  const prefix = (row: Fact, name: string) => (bothPlatforms ? `${row.platform === "google" ? "Google" : "Meta"} · ${name}` : name);
  const campaigns = groupFacts(campaignBasis === "campaign" ? campaignRows : adsetRows, (row) => ({
    id: `${row.platform}:${row.campaignId || row.campaignName}`,
    name: prefix(row, row.campaignName || row.campaignId || "Untitled campaign"),
  }));
  const adsets = groupFacts(adsetRows, (row) => ({
    id: `${row.platform}:${row.adsetId || row.adsetName}`,
    name: prefix(row, row.adsetName || row.adsetId || "Untitled ad set"),
  }));

  return {
    range: input.range,
    from: rangeWindow.from,
    to: rangeWindow.to,
    fromLabel: formatDay(rangeWindow.from),
    toLabel: formatDay(rangeWindow.to),
    level,
    levelLabel: `${googleOnly && level ? "Google ingest. " : ""}${bothPlatforms ? "Meta only. Google rows are listed under Campaigns. " : ""}${levelLabel(level)}`,
    mixedCurrencies: currencies.length > 1 ? currencies : null,
    headline,
    roas: headline ? formatRoas(headline.revenuePence, headline.spendPence) : null,
    cpa: headline ? formatCpa(headline.spendPence, headline.orders, headline.currency) : null,
    daily: eachDate(rangeWindow.from, rangeWindow.to).map((date) => ({
      date,
      label: formatDay(date),
      totals: level ? sumFacts(headlineRows.filter((row) => row.date === date)) : null,
    })),
    weeks,
    partial: {
      ...partial,
      fromLabel: formatDay(wow.thisPartial.from),
      toLabel: formatDay(wow.thisPartial.to),
      previousFromLabel: formatDay(wow.prevPartial.from),
      previousToLabel: formatDay(wow.prevPartial.to),
      elapsed: wow.elapsed,
      revenueChangeLabel: formatChange(partial.revenueChange),
      spendChangeLabel: formatChange(partial.spendChange),
      ordersChangeLabel: formatChange(partial.ordersChange),
    },
    full: {
      ...full,
      fromLabel: formatDay(wow.lastFull.from),
      toLabel: formatDay(wow.lastFull.to),
      previousFromLabel: formatDay(wow.priorFull.from),
      previousToLabel: formatDay(wow.priorFull.to),
      revenueChangeLabel: formatChange(full.revenueChange),
    },
    campaigns,
    adsets,
    campaignBasis,
    metaConnected: input.metaConnected,
    googleRows: input.googleRows,
    hasRows: input.rows.length > 0,
    sources: [...new Set(headlineRows.map((row) => row.source))],
  };
}

function sumWindow(rows: Fact[], level: string | null, from: string, to: string) {
  if (!level) return null;
  return sumFacts(inWindow(rowsForLevel(rows, level), from, to));
}

function weekRows(rows: Fact[], today: string) {
  const start = mondayOf(today);
  const out = [];
  for (let index = 7; index >= 0; index -= 1) {
    const from = addDays(start, -7 * index);
    const to = index === 0 ? today : addDays(from, 6);
    const previousFrom = addDays(from, -7);
    const previousTo = addDays(from, -1);
    const level = headlineLevel([...inWindow(rows, from, to), ...inWindow(rows, previousFrom, previousTo)]);
    const totals = sumWindow(rows, level, from, to);
    const previous = sumWindow(rows, level, previousFrom, previousTo);
    const compared = compareTotals(totals, previous);
    out.push({
      from,
      to,
      label: `${formatDay(from)} – ${formatDay(to)}`,
      partial: index === 0,
      totals,
      revenueChangeLabel: formatChange(compared.revenueChange),
      targetLabel: compared.targetRevenuePence !== null && totals ? formatMoney(compared.targetRevenuePence, totals.currency) : null,
      ahead: compared.ahead,
      reason: compared.reason,
    });
  }
  return out.filter((week) => week.totals);
}

export function moneyOrDash(pence: number | null | undefined, currency: string | undefined) {
  if (pence === null || pence === undefined || !currency) return "—";
  return formatMoney(pence, currency);
}
