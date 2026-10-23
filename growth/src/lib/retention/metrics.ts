import { addMonths, monthKey } from "@/lib/dates";

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
