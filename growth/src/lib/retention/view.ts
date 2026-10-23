import { formatDay, formatMonth } from "@/lib/dates";
import { formatRate } from "@/lib/format";
import { cohortRetention, listGrowth, preferLatest, repeatPurchase, type ListPoint, type OrderFact, type SendFact } from "@/lib/retention/metrics";

export function buildRetentionView(input: { orders: OrderFact[]; lists: ListPoint[]; flows: SendFact[]; campaigns: SendFact[] }) {
  const repeat = repeatPurchase(input.orders);
  const cohorts = cohortRetention(input.orders);
  const lists = listGrowth(input.lists);
  return {
    repeat: repeat
      ? {
          ...repeat,
          rateLabel: formatRate(repeat.rate),
          firstLabel: formatDay(repeat.first),
          lastLabel: formatDay(repeat.last),
        }
      : null,
    cohorts: cohorts
      ? {
          latest: cohorts.latest,
          latestLabel: formatMonth(cohorts.latest),
          rows: cohorts.rows.map((row) => ({
            ...row,
            label: formatMonth(row.cohort),
            rates: row.retained.map((count) => (count === null || row.customers === 0 ? null : count / row.customers)),
          })),
        }
      : null,
    lists: lists.map((row) => ({
      ...row,
      latestLabel: formatDay(row.latest.capturedOn),
      previousLabel: row.previous ? formatDay(row.previous.capturedOn) : null,
    })),
    flows: {
      "7d": preferLatest(input.flows.filter((row) => row.window === "7d")),
      "30d": preferLatest(input.flows.filter((row) => row.window === "30d")),
    },
    campaigns: {
      "7d": preferLatest(input.campaigns.filter((row) => row.window === "7d")),
      "30d": preferLatest(input.campaigns.filter((row) => row.window === "30d")),
    },
  };
}
