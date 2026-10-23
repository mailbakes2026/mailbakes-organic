import { addDays, londonWeekStart } from "./dates.ts";
import { STAGES, type StageSlug } from "./stages.ts";

export type StatRow = {
  stage: StageSlug;
  rush: boolean;
  shipDate: string | null;
};

const SHIPPED_STAGES: StageSlug[] = ["shipped", "delivered", "posted"];

export function stageCounts(rows: StatRow[]) {
  const counts = Object.fromEntries(STAGES.map((stage) => [stage.slug, 0])) as Record<StageSlug, number>;
  for (const row of rows) counts[row.stage] += 1;
  return counts;
}

/** Cards with a ship date in the current London week (Monday to Sunday) that have left the bench. */
export function shippedThisWeek(rows: StatRow[], now = new Date()) {
  const start = londonWeekStart(now);
  const end = addDays(start, 6);
  return rows.filter((row) => {
    if (!row.shipDate) return false;
    if (!SHIPPED_STAGES.includes(row.stage)) return false;
    return row.shipDate >= start && row.shipDate <= end;
  }).length;
}

export function awaitingMessage(rows: StatRow[]) {
  return rows.filter((row) => row.stage === "message_needed").length;
}

export type SummaryCreator = StatRow & {
  posted: boolean;
  tiktokOrderId: string;
};

/** Counts for the CEO service. Names, messages, and order IDs stay out of the result. */
export function ceoSummary(rows: SummaryCreator[], now = new Date()) {
  let active = 0;
  let posted = 0;
  let unmatched = 0;
  for (const row of rows) {
    const isPosted = row.posted || row.stage === "posted";
    if (isPosted) posted += 1;
    if (row.stage !== "declined" && !isPosted) active += 1;
    if (row.tiktokOrderId.trim() === "") unmatched += 1;
  }
  return {
    active,
    shipped_this_week: shippedThisWeek(rows, now),
    awaiting_message: awaitingMessage(rows),
    posted,
    unmatched_orders: unmatched,
  };
}

export function rushItems(rows: StatRow[]) {
  return rows.filter((row) => row.rush && row.stage !== "declined").length;
}

export type RankRow = {
  name: string;
  worksWell: boolean;
  rating: number | null;
  orders: number | null;
  views: number | null;
};

function rankNumber(value: number | null) {
  return value === null ? Number.NEGATIVE_INFINITY : value;
}

export function leaderboard<T extends RankRow>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (a.worksWell !== b.worksWell) return a.worksWell ? -1 : 1;
    const rating = rankNumber(b.rating) - rankNumber(a.rating);
    if (rating) return rating;
    const orders = rankNumber(b.orders) - rankNumber(a.orders);
    if (orders) return orders;
    const views = rankNumber(b.views) - rankNumber(a.views);
    if (views) return views;
    return a.name.localeCompare(b.name, "en-GB");
  });
}
