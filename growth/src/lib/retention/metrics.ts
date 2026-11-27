import { addMonths, monthKey, parseDateOnly } from "@/lib/dates";
import { sumMoney } from "@/lib/retention/weeks";

export type OrderFact = {
  id: string;
  customerId: string;
  orderedOn: string;
};

export type RepeatSummary = {
  customers: number;
  repeatCustomers: number;
  rate: number;
  histogram: { label: string; count: number }[];
  guestOrders: number;
  first: string;
  last: string;
};

export function repeatPurchase(orders: OrderFact[]): RepeatSummary | null {
  if (orders.length === 0) return null;
  const guests = orders.filter((order) => !order.customerId).length;
  const withCustomer = orders.filter((order) => order.customerId);
  if (withCustomer.length === 0) return null;
  const counts = new Map<string, number>();
  for (const order of withCustomer) counts.set(order.customerId, (counts.get(order.customerId) ?? 0) + 1);
  const histogram = [
    { label: "1", count: 0 },
    { label: "2", count: 0 },
    { label: "3", count: 0 },
    { label: "4", count: 0 },
    { label: "5+", count: 0 },
  ];
  let repeatCustomers = 0;
  for (const count of counts.values()) {
    if (count >= 2) repeatCustomers += 1;
    if (count >= 5) histogram[4]!.count += 1;
    else histogram[count - 1]!.count += 1;
  }
  const dates = withCustomer.map((order) => order.orderedOn).sort();
  return {
    customers: counts.size,
    repeatCustomers,
    rate: counts.size === 0 ? 0 : repeatCustomers / counts.size,
    histogram,
    guestOrders: guests,
    first: dates[0] ?? "",
    last: dates[dates.length - 1] ?? "",
  };
}

export type CohortRow = {
  cohort: string;
  customers: number;
  retained: (number | null)[];
};

export function cohortRetention(orders: OrderFact[], offsets = 4): { rows: CohortRow[]; latest: string } | null {
  const withCustomer = orders.filter((order) => order.customerId && /^\d{4}-\d{2}-\d{2}$/.test(order.orderedOn));
  if (withCustomer.length === 0) return null;
  const byCustomer = new Map<string, Set<string>>();
  for (const order of withCustomer) {
    const months = byCustomer.get(order.customerId) ?? new Set<string>();
    months.add(monthKey(order.orderedOn));
    byCustomer.set(order.customerId, months);
  }
  const firstMonth = new Map<string, string>();
  for (const [customer, months] of byCustomer) {
    firstMonth.set(customer, [...months].sort()[0] ?? "");
  }
  const cohorts = [...new Set(firstMonth.values())].filter(Boolean).sort();
  const latest = [...withCustomer.map((order) => monthKey(order.orderedOn))].sort().at(-1) ?? cohorts.at(-1) ?? "";
  const rows = cohorts.map((cohort) => {
    const customers = [...firstMonth.entries()].filter(([, month]) => month === cohort).map(([id]) => id);
    const retained = Array.from({ length: offsets }, (_, offset) => {
      const month = addMonths(cohort, offset);
      if (month > latest) return null;
      return customers.filter((id) => byCustomer.get(id)?.has(month)).length;
    });
    return { cohort, customers: customers.length, retained };
  });
  return { rows, latest };
}

export type ListPoint = {
  listId: string;
  listName: string;
  profiles: number | null;
  capturedOn: string;
};

export function listGrowth(snapshots: ListPoint[]) {
  const groups = new Map<string, ListPoint[]>();
  for (const snapshot of snapshots) {
    const list = groups.get(snapshot.listId) ?? [];
    list.push(snapshot);
    groups.set(snapshot.listId, list);
  }
  return [...groups.values()].map((points) => {
    const ordered = [...points].sort((a, b) => a.capturedOn.localeCompare(b.capturedOn) || a.listName.localeCompare(b.listName));
    const latest = ordered[ordered.length - 1]!;
    const previous = [...ordered].reverse().find((point) => point.capturedOn < latest.capturedOn) ?? null;
    const delta =
      latest.profiles !== null && previous?.profiles !== null && previous ? latest.profiles - previous.profiles : null;
    return { latest, previous, delta };
  });
}

export type SendFact = {
  id: string;
  name: string;
  window: string;
  revenuePence: number | null;
  opens: number | null;
  clicks: number | null;
  delivered: number | null;
  unsubscribes: number | null;
  openRate: number | null;
  clickRate: number | null;
  currency: string;
  source: string;
  updatedAt: string;
};

export function preferLatest(rows: SendFact[]) {
  const best = new Map<string, SendFact>();
  for (const row of rows) {
    const key = `${row.window}:${row.id}`;
    const current = best.get(key);
    if (!current || row.updatedAt > current.updatedAt) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => (b.revenuePence ?? -1) - (a.revenuePence ?? -1) || a.name.localeCompare(b.name));
}

export function rateFromCounts(part: number | null, whole: number | null) {
  if (part === null || whole === null || whole <= 0) return null;
  return part / whole;
}

export type PricedOrder = OrderFact & { totalPence?: number | null; currency?: string };

export type CustomerSegment = {
  customers: number;
  share: number;
  orders: number;
  avgOrders: number | null;
  avgSpendPence: number | null;
  currency: string;
  mixed: boolean;
};

export type CustomerPicture = {
  customers: number;
  newCustomers: number;
  returningCustomers: number;
  newRevenuePence: number | null;
  returningRevenuePence: number | null;
  currency: string;
  mixed: boolean;
  avgDaysToSecond: number | null;
  secondOrderCustomers: number;
  guestOrders: number;
  first: string;
  last: string;
  vips: CustomerSegment;
  due: CustomerSegment;
  lapsed: CustomerSegment;
};

function daySpan(from: string, to: string) {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function orderMoney(orders: PricedOrder[]) {
  if (!orders.length) return { pence: 0, currency: "GBP", mixed: false };
  if (orders.some((order) => typeof order.totalPence !== "number")) return { pence: null as number | null, currency: "GBP", mixed: false };
  return sumMoney(orders.map((order) => ({ revenuePence: order.totalPence ?? null, currency: order.currency || "GBP" })));
}

function segmentOf(ids: string[], byCustomer: Map<string, PricedOrder[]>, base: number): CustomerSegment {
  const orders = ids.flatMap((id) => byCustomer.get(id) ?? []);
  const money = orderMoney(orders);
  return {
    customers: ids.length,
    share: base === 0 ? 0 : ids.length / base,
    orders: orders.length,
    avgOrders: ids.length ? orders.length / ids.length : null,
    avgSpendPence: money.pence === null || !ids.length ? null : Math.round(money.pence / ids.length),
    currency: money.currency,
    mixed: money.mixed,
  };
}

export function customerPicture(orders: PricedOrder[], today: string): CustomerPicture | null {
  if (!parseDateOnly(today)) return null;
  const guestOrders = orders.filter((order) => !order.customerId).length;
  const withCustomer = orders.filter((order) => order.customerId && parseDateOnly(order.orderedOn));
  if (!withCustomer.length) return null;
  const byCustomer = new Map<string, PricedOrder[]>();
  for (const order of withCustomer) {
    const list = byCustomer.get(order.customerId) ?? [];
    list.push(order);
    byCustomer.set(order.customerId, list);
  }
  let newCustomers = 0;
  let returningCustomers = 0;
  const newOrders: PricedOrder[] = [];
  const returningOrders: PricedOrder[] = [];
  const gaps: number[] = [];
  const vips: string[] = [];
  const due: string[] = [];
  const lapsed: string[] = [];
  let first = "9999-99-99";
  let last = "0000-00-00";
  for (const [id, list] of byCustomer) {
    const ordered = [...list].sort((a, b) => a.orderedOn.localeCompare(b.orderedOn) || a.id.localeCompare(b.id));
    const earliest = ordered[0]?.orderedOn ?? "";
    const latest = ordered[ordered.length - 1]?.orderedOn ?? "";
    if (earliest && earliest < first) first = earliest;
    if (latest && latest > last) last = latest;
    if (list.length >= 2) {
      returningCustomers += 1;
      returningOrders.push(...list);
      const gap = daySpan(ordered[0]!.orderedOn, ordered[1]!.orderedOn);
      if (gap !== null && gap >= 0) gaps.push(gap);
    } else {
      newCustomers += 1;
      newOrders.push(...list);
    }
    if (list.length >= 3) vips.push(id);
    const since = latest ? daySpan(latest, today) : null;
    if (since !== null && since >= 30 && since <= 60) due.push(id);
    if (since !== null && since >= 90) lapsed.push(id);
  }
  const base = byCustomer.size;
  const newMoney = orderMoney(newOrders);
  const returnMoney = orderMoney(returningOrders);
  const mixed =
    newMoney.mixed ||
    returnMoney.mixed ||
    (newMoney.pence !== null && returnMoney.pence !== null && newMoney.currency !== returnMoney.currency);
  const currency = !newMoney.mixed && newMoney.pence !== null ? newMoney.currency : !returnMoney.mixed && returnMoney.pence !== null ? returnMoney.currency : "GBP";
  const avgDaysToSecond = gaps.length ? Math.round((gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) * 10) / 10 : null;
  return {
    customers: base,
    newCustomers,
    returningCustomers,
    newRevenuePence: newMoney.mixed ? null : newMoney.pence,
    returningRevenuePence: returnMoney.mixed ? null : returnMoney.pence,
    currency,
    mixed,
    avgDaysToSecond,
    secondOrderCustomers: gaps.length,
    guestOrders,
    first,
    last,
    vips: segmentOf(vips, byCustomer, base),
    due: segmentOf(due, byCustomer, base),
    lapsed: segmentOf(lapsed, byCustomer, base),
  };
}

export function listSummary(rows: { latest: { profiles: number | null }; delta: number | null }[]) {
  const known = rows.filter((row) => row.latest.profiles !== null);
  const deltas = rows.map((row) => row.delta).filter((delta): delta is number => delta !== null);
  return {
    lists: rows.length,
    total: known.length ? known.reduce((sum, row) => sum + (row.latest.profiles ?? 0), 0) : null,
    net: deltas.length ? deltas.reduce((sum, delta) => sum + delta, 0) : null,
    missingProfiles: rows.length - known.length,
  };
}
