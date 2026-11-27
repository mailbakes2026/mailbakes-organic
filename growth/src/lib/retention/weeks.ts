import { addDays, mondayOf, parseDateOnly } from "@/lib/dates";

export type Money = { pence: number | null; currency: string; mixed: boolean };

export type PulsePoint = {
  capturedOn: string;
  flowRevenuePence: number | null;
  campaignRevenuePence: number | null;
  currency: string;
  mixedCurrency: boolean;
  repeatRate: number | null;
  repeatCustomers: number | null;
  customers: number | null;
};

export type WeekCard = {
  key: "total" | "flow" | "campaign" | "repeat";
  label: string;
  pence: number | null;
  rate: number | null;
  currency: string;
  mixed: boolean;
  change: number | null;
  direction: "up" | "down" | "flat" | "unknown";
  hint: string;
  unknownLabel: string;
};

export type WeekBar = {
  weekStart: string;
  label: string;
  flowPence: number | null;
  campaignPence: number | null;
};

export type WeekStory = {
  cards: WeekCard[];
  bars: WeekBar[];
  compared: boolean;
  note: string;
  chartNote: string;
};

const EMPTY_MONEY: Money = { pence: null, currency: "GBP", mixed: false };

export function sumMoney(rows: { revenuePence: number | null; currency: string }[]): Money {
  const withMoney = rows.filter((row) => row.revenuePence !== null);
  if (!withMoney.length) return { ...EMPTY_MONEY };
  const currencies = [...new Set(withMoney.map((row) => (/^[A-Z]{3}$/.test(row.currency) ? row.currency : "GBP")))];
  if (currencies.length !== 1) return { pence: null, currency: "GBP", mixed: true };
  return {
    pence: withMoney.reduce((sum, row) => sum + (row.revenuePence ?? 0), 0),
    currency: currencies[0] ?? "GBP",
    mixed: false,
  };
}

export function combineMoney(left: Money, right: Money): Money {
  if (left.mixed || right.mixed) return { pence: null, currency: "GBP", mixed: true };
  if (left.pence === null || right.pence === null) return { ...EMPTY_MONEY };
  if (left.currency !== right.currency) return { pence: null, currency: "GBP", mixed: true };
  return { pence: left.pence + right.pence, currency: left.currency, mixed: false };
}

export function relativeChange(current: number | null, previous: number | null) {
  if (current === null || previous === null) return { ratio: null as number | null, direction: "unknown" as const };
  if (previous === 0) {
    if (current === 0) return { ratio: 0, direction: "flat" as const };
    return { ratio: null, direction: "unknown" as const };
  }
  const ratio = (current - previous) / Math.abs(previous);
  if (!Number.isFinite(ratio)) return { ratio: null, direction: "unknown" as const };
  if (Math.abs(ratio) < 0.0005) return { ratio: 0, direction: "flat" as const };
  return { ratio, direction: ratio > 0 ? ("up" as const) : ("down" as const) };
}

export function trailingRepeat(orders: { customerId: string; orderedOn: string }[], end: string) {
  if (!parseDateOnly(end)) return null;
  const start = addDays(end, -6);
  const before = new Set<string>();
  const inWindow = new Set<string>();
  for (const order of orders) {
    if (!order.customerId || !parseDateOnly(order.orderedOn)) continue;
    if (order.orderedOn < start) before.add(order.customerId);
    else if (order.orderedOn <= end) inWindow.add(order.customerId);
  }
  if (!inWindow.size) return null;
  let repeatCustomers = 0;
  for (const id of inWindow) if (before.has(id)) repeatCustomers += 1;
  return { customers: inWindow.size, repeatCustomers, rate: repeatCustomers / inWindow.size };
}

function daysApart(from: string, to: string) {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end) return 99;
  return Math.abs(Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

export function priorPulse<T extends { capturedOn: string }>(pulses: T[], today: string): T | null {
  const target = addDays(today, -7);
  const exact = pulses.find((pulse) => pulse.capturedOn === target);
  if (exact) return exact;
  const start = mondayOf(target);
  const end = addDays(start, 6);
  const inWeek = pulses.filter((pulse) => pulse.capturedOn >= start && pulse.capturedOn <= end && pulse.capturedOn < today);
  if (!inWeek.length) return null;
  return [...inWeek].sort((a, b) => daysApart(a.capturedOn, target) - daysApart(b.capturedOn, target) || b.capturedOn.localeCompare(a.capturedOn))[0] ?? null;
}

export function recentWeekStarts(today: string, count = 8) {
  const start = mondayOf(today);
  const weeks: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) weeks.push(addDays(start, -7 * index));
  return weeks;
}

function shortLabel(day: string) {
  const parsed = parseDateOnly(day);
  if (!parsed) return day;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(parsed);
}

function moneyFrom(pence: number | null, currency: string, mixed: boolean): Money {
  if (mixed) return { pence: null, currency: "GBP", mixed: true };
  return { pence, currency: /^[A-Z]{3}$/.test(currency) ? currency : "GBP", mixed: false };
}

function latestInWeek<T extends { capturedOn: string }>(pulses: T[], weekStart: string) {
  const end = addDays(weekStart, 6);
  return (
    pulses
      .filter((pulse) => pulse.capturedOn >= weekStart && pulse.capturedOn <= end)
      .sort((a, b) => b.capturedOn.localeCompare(a.capturedOn))[0] ?? null
  );
}

function makeCard(
  partial: Omit<WeekCard, "change" | "direction" | "unknownLabel"> & { current: number | null; previous: number | null; hasPrior: boolean },
): WeekCard {
  const change = relativeChange(partial.current, partial.previous);
  return {
    key: partial.key,
    label: partial.label,
    pence: partial.pence,
    rate: partial.rate,
    currency: partial.currency,
    mixed: partial.mixed,
    change: change.ratio,
    direction: change.direction,
    hint: partial.hint,
    unknownLabel: partial.hasPrior ? "No baseline" : "No prior week",
  };
}

export function weekStory(input: {
  today: string;
  current: PulsePoint;
  pulses: PulsePoint[];
  calendar: { sendDate: string; revenuePence: number | null; currency: string }[];
}): WeekStory {
  const prior = priorPulse(input.pulses, input.today);
  const flow = moneyFrom(input.current.flowRevenuePence, input.current.currency, false);
  const campaign = moneyFrom(input.current.campaignRevenuePence, input.current.currency, false);
  const total = input.current.mixedCurrency ? { pence: null, currency: "GBP", mixed: true } : combineMoney(flow, campaign);
  const priorFlow = prior ? moneyFrom(prior.flowRevenuePence, prior.currency, false) : null;
  const priorCampaign = prior ? moneyFrom(prior.campaignRevenuePence, prior.currency, false) : null;
  const priorTotal = !prior || !priorFlow || !priorCampaign ? null : prior.mixedCurrency ? { pence: null, currency: "GBP", mixed: true } : combineMoney(priorFlow, priorCampaign);
  const hasPrior = prior !== null;

  const cards: WeekCard[] = [
    makeCard({
      key: "total",
      label: "Total retention revenue",
      pence: total.pence,
      rate: null,
      currency: total.currency,
      mixed: total.mixed,
      hint: total.mixed ? "Mixed currencies" : total.pence === null ? "Needs both flow and campaign revenue" : "Flows and campaigns, last 7 days",
      current: total.pence,
      previous: priorTotal?.pence ?? null,
      hasPrior,
    }),
    makeCard({
      key: "flow",
      label: "Flow revenue",
      pence: flow.pence,
      rate: null,
      currency: flow.currency,
      mixed: flow.mixed,
      hint: flow.mixed ? "Mixed currencies" : flow.pence === null ? "No flow revenue stored" : "Last 7 days",
      current: flow.pence,
      previous: priorFlow?.pence ?? null,
      hasPrior,
    }),
    makeCard({
      key: "campaign",
      label: "Campaign revenue",
      pence: campaign.pence,
      rate: null,
      currency: campaign.currency,
      mixed: campaign.mixed,
      hint: campaign.mixed ? "Mixed currencies" : campaign.pence === null ? "No campaign revenue stored" : "Last 7 days",
      current: campaign.pence,
      previous: priorCampaign?.pence ?? null,
      hasPrior,
    }),
    makeCard({
      key: "repeat",
      label: "Repeat purchase rate",
      pence: null,
      rate: input.current.repeatRate,
      currency: "GBP",
      mixed: false,
      hint: input.current.repeatRate === null ? "No orders in the last 7 days" : "Customers who ordered again in the last 7 days",
      current: input.current.repeatRate,
      previous: prior?.repeatRate ?? null,
      hasPrior,
    }),
  ];

  const bars = recentWeekStarts(input.today).map((weekStart) => {
    const pulse = latestInWeek(input.pulses, weekStart);
    const end = addDays(weekStart, 6);
    const fromCalendar = sumMoney(input.calendar.filter((row) => row.sendDate >= weekStart && row.sendDate <= end));
    return {
      weekStart,
      label: shortLabel(weekStart),
      flowPence: pulse ? pulse.flowRevenuePence : null,
      campaignPence: pulse ? pulse.campaignRevenuePence : fromCalendar.mixed ? null : fromCalendar.pence,
    };
  });

  const compared = cards.some((item) => item.direction !== "unknown");
  return {
    cards,
    bars,
    compared,
    note: compared
      ? "Change is against the 7-day figures stored a week earlier."
      : "Up and down badges appear once a sync from the previous week is stored.",
    chartNote: "Each pair is one week. Flow revenue is a stored sync. Campaign revenue uses that sync, or calendar results when no sync is stored.",
  };
}

export function emptyWeekStory(today: string): WeekStory {
  return weekStory({
    today,
    current: {
      capturedOn: today,
      flowRevenuePence: null,
      campaignRevenuePence: null,
      currency: "GBP",
      mixedCurrency: false,
      repeatRate: null,
      repeatCustomers: null,
      customers: null,
    },
    pulses: [],
    calendar: [],
  });
}
