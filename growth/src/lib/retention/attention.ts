import { formatChange, formatMoney } from "@/lib/format";
import { relativeChange } from "@/lib/retention/weeks";

export type FlowIconKind = "cart" | "welcome" | "browse" | "winback" | "post" | "flow";

export type FlowCardModel = {
  id: string;
  name: string;
  status: string;
  revenuePence: number | null;
  previousRevenuePence: number | null;
  currency: string;
  delivered: number | null;
  openRate: number | null;
  clickRate: number | null;
  monthRevenuePence: number | null;
};

type FlowRow = {
  id: string;
  name: string;
  status?: string;
  revenuePence: number | null;
  currency: string;
  delivered: number | null;
  openRate: number | null;
  clickRate: number | null;
};

type ExperimentRow = {
  flowId: string;
  flowName: string;
  name: string;
  status: string;
  metricA: string;
  metricB: string;
  winner: string;
};

export function flowIconKind(name: string): FlowIconKind {
  const text = name.toLowerCase();
  if (text.includes("browse") || text.includes("viewed")) return "browse";
  if ((text.includes("win") && text.includes("back")) || text.includes("lapsed") || text.includes("sunset")) return "winback";
  if (text.includes("welcome") || text.includes("sign up") || text.includes("signup")) return "welcome";
  if (text.includes("cart") || text.includes("checkout") || text.includes("abandon")) return "cart";
  if (text.includes("post") || text.includes("thank") || text.includes("review") || text.includes("fulfil")) return "post";
  return "flow";
}

export function klaviyoFlowUrl(id: string) {
  return /^[A-Za-z0-9]{6,32}$/.test(id) ? `https://www.klaviyo.com/flow/${id}/edit` : null;
}

export function klaviyoCampaignUrl(id: string) {
  return /^[A-Za-z0-9]{6,32}$/.test(id) ? `https://www.klaviyo.com/campaign/${id}/wizard` : null;
}

export function flowCards(input: { week: FlowRow[]; month: FlowRow[]; previous: FlowRow[] }): FlowCardModel[] {
  const week = new Map(input.week.map((row) => [row.id, row]));
  const month = new Map(input.month.map((row) => [row.id, row]));
  const previous = new Map(input.previous.map((row) => [row.id, row]));
  const ids = [...month.keys(), ...week.keys()].filter((id, index, all) => id && all.indexOf(id) === index);
  return ids
    .map((id) => {
      const current = week.get(id) ?? month.get(id);
      const older = month.get(id);
      const prior = previous.get(id);
      if (!current) return null;
      const status = current.status || older?.status || "";
      return {
        id,
        name: current.name || older?.name || id,
        status,
        revenuePence: week.get(id)?.revenuePence ?? null,
        previousRevenuePence: prior?.revenuePence ?? null,
        currency: current.currency || prior?.currency || "GBP",
        delivered: current.delivered,
        openRate: current.openRate,
        clickRate: current.clickRate,
        monthRevenuePence: older?.revenuePence ?? null,
      };
    })
    .filter((row): row is FlowCardModel => row !== null)
    .sort((a, b) => (b.revenuePence ?? b.monthRevenuePence ?? -1) - (a.revenuePence ?? a.monthRevenuePence ?? -1) || a.name.localeCompare(b.name));
}

function moneyDrop(current: number, previous: number, currency: string) {
  return formatMoney(Math.abs(current - previous), currency || "GBP");
}

function percent(current: number, previous: number) {
  return formatChange(relativeChange(current, previous).ratio) ?? "";
}

export function flowCallouts(cards: FlowCardModel[], experiments: ExperimentRow[]) {
  const notes: string[] = [];
  const seen = new Set<string>();
  const drops = cards
    .flatMap((card) => {
      if (card.revenuePence === null || card.previousRevenuePence === null) return [];
      const change = relativeChange(card.revenuePence, card.previousRevenuePence);
      if (change.direction !== "down" || change.ratio === null || change.ratio >= -0.15) return [];
      return [{ card, ratio: change.ratio }];
    })
    .sort((a, b) => a.ratio - b.ratio);
  for (const drop of drops) {
    if (notes.length >= 3) break;
    notes.push(`${drop.card.name} is down ${moneyDrop(drop.card.revenuePence!, drop.card.previousRevenuePence!, drop.card.currency)} (${percent(drop.card.revenuePence!, drop.card.previousRevenuePence!).replace("-", "")}) on last week.`);
    seen.add(drop.card.id);
  }
  for (const test of experiments) {
    if (notes.length >= 3) break;
    if (test.status !== "running" || test.winner || !test.metricA.trim() || !test.metricB.trim()) continue;
    const flow = test.flowName || "A flow";
    notes.push(`${test.name} on ${flow} has results on both variants. Call a winner.`);
  }
  for (const card of cards) {
    if (notes.length >= 3 || seen.has(card.id)) continue;
    if (card.status === "draft" || card.status === "manual") {
      notes.push(card.status === "draft" ? `${card.name} is still a draft in Klaviyo.` : `${card.name} is set to manual in Klaviyo, so it is not sending on its own.`);
      seen.add(card.id);
    }
  }
  for (const card of cards) {
    if (notes.length >= 3 || seen.has(card.id)) continue;
    if (card.revenuePence === 0) {
      notes.push(`${card.name} made ${formatMoney(0, card.currency || "GBP")} this week.`);
      seen.add(card.id);
    }
  }
  return notes.slice(0, 3);
}

export function benchmarkNote(rate: number | null, average: number | null) {
  if (rate === null || average === null) return null;
  const points = (rate - average) * 100;
  if (Math.abs(points) < 0.05) return "Open rate is in line with the account.";
  const figure = `${Math.abs(points).toFixed(1)} pts`;
  return points > 0 ? `Open rate is ${figure} above the account.` : `Open rate is ${figure} below the account.`;
}

export function campaignCallouts(
  rows: {
    id: string;
    name: string;
    weekRevenuePence: number | null;
    previousRevenuePence: number | null;
    currency: string;
    weekOpenRate: number | null;
    averageOpenRate: number | null;
    hasVisual: boolean;
  }[],
) {
  const notes: string[] = [];
  const seen = new Set<string>();
  const drops = rows
    .flatMap((row) => {
      if (row.weekRevenuePence === null || row.previousRevenuePence === null) return [];
      const change = relativeChange(row.weekRevenuePence, row.previousRevenuePence);
      if (change.direction !== "down" || change.ratio === null || change.ratio >= -0.15) return [];
      return [{ row, ratio: change.ratio }];
    })
    .sort((a, b) => a.ratio - b.ratio);
  for (const drop of drops) {
    if (notes.length >= 3) break;
    notes.push(`${drop.row.name} is down ${moneyDrop(drop.row.weekRevenuePence!, drop.row.previousRevenuePence!, drop.row.currency)} (${percent(drop.row.weekRevenuePence!, drop.row.previousRevenuePence!).replace("-", "")}) on last week.`);
    seen.add(drop.row.id);
  }
  for (const row of rows) {
    if (notes.length >= 3 || seen.has(row.id)) continue;
    if (row.weekOpenRate === null || row.averageOpenRate === null) continue;
    const points = (row.weekOpenRate - row.averageOpenRate) * 100;
    if (points > -5) continue;
    notes.push(`${row.name} open rate is ${Math.abs(points).toFixed(1)} pts below the account.`);
    seen.add(row.id);
  }
  for (const row of rows) {
    if (notes.length >= 3 || seen.has(row.id) || row.hasVisual) continue;
    if ((row.weekRevenuePence ?? 0) <= 0 && (row.previousRevenuePence ?? 0) <= 0) continue;
    notes.push(`${row.name} has revenue stored, but no email visual yet.`);
    seen.add(row.id);
  }
  return notes.slice(0, 3);
}
