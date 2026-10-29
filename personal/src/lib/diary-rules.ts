// Pure rules for the diary: checking input, and turning each app's summary
// into a short debrief. No database here, so it can be unit tested.

export class DiaryError extends Error {}

export const DEBRIEF_SOURCES = ["operations", "orders", "finance", "conversion", "organic", "other"] as const;
export type DebriefSource = (typeof DEBRIEF_SOURCES)[number];

export const SOURCE_LABELS: Record<DebriefSource, string> = {
  operations: "Operations",
  orders: "Daily Orders",
  finance: "Finance",
  conversion: "Conversion",
  organic: "Organic",
  other: "Other",
};

export type DebriefInput = {
  source: DebriefSource;
  kind: string;
  day: string;
  title: string;
  lines: string[];
  link: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function cleanDay(value: unknown, label = "day"): string {
  if (typeof value !== "string" || !DAY.test(value.trim())) throw new DiaryError(`The ${label} must be YYYY-MM-DD.`);
  const day = value.trim();
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new DiaryError(`The ${label} must be a real date.`);
  }
  return day;
}

export function cleanItemText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new DiaryError("Write something to tick off.");
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length > 300) throw new DiaryError("Keep a checklist line under 300 characters.");
  return text;
}

export function cleanNote(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new DiaryError("Notes must be text.");
  if (value.length > 20000) throw new DiaryError("That note is too long.");
  return value;
}

function cleanLink(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value !== "string") throw new DiaryError("The link must be a web address.");
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString();
  } catch {
    throw new DiaryError("The link must be a web address.");
  }
}

/**
 * Checks a debrief sent in by another app.
 * { source, title, lines: [..], day?: YYYY-MM-DD (default today), kind?: "daily", link? }
 */
export function cleanDebrief(input: unknown, today: string): DebriefInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new DiaryError("Send a JSON object.");
  const body = input as Record<string, unknown>;
  const source = typeof body.source === "string" ? body.source.trim().toLowerCase() : "";
  if (!(DEBRIEF_SOURCES as readonly string[]).includes(source)) {
    throw new DiaryError(`source must be one of: ${DEBRIEF_SOURCES.join(", ")}.`);
  }
  const kind = body.kind == null || body.kind === "" ? "daily" : String(body.kind).trim().toLowerCase();
  if (!/^[a-z0-9-]{1,40}$/.test(kind)) throw new DiaryError("kind must be short: letters, numbers and dashes.");
  const day = body.day == null || body.day === "" ? today : cleanDay(body.day);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) throw new DiaryError("Add a title.");
  if (title.length > 200) throw new DiaryError("The title is too long.");
  if (!Array.isArray(body.lines)) throw new DiaryError("lines must be a list of text.");
  const lines = body.lines
    .map((line) => (typeof line === "string" ? line.trim() : ""))
    .filter(Boolean)
    .slice(0, 40)
    .map((line) => line.slice(0, 500));
  return { source: source as DebriefSource, kind, day, title, lines, link: cleanLink(body.link) };
}

// ------------------------------------------------------------ summaries → debriefs

function pounds(value: unknown): string | null {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return null;
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function count(value: unknown): number | null {
  const n = Number(value);
  return value == null || !Number.isFinite(n) ? null : Math.round(n);
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}

/** Finance /api/v1/summary: { week: {revenue, gross_margin_pct, net_profit}, month: {...} } */
export function financeDebrief(summary: unknown, day: string): DebriefInput | null {
  const s = summary as { week?: Record<string, unknown>; month?: Record<string, unknown> } | null;
  if (!s?.week && !s?.month) return null;
  const lines: string[] = [];
  const period = (label: string, p?: Record<string, unknown>) => {
    if (!p) return;
    const parts = [
      pounds(p.revenue) && `revenue ${pounds(p.revenue)}`,
      p.gross_margin_pct != null && Number.isFinite(Number(p.gross_margin_pct)) && `gross margin ${Math.round(Number(p.gross_margin_pct))}%`,
      pounds(p.net_profit) && `net profit ${pounds(p.net_profit)}`,
    ].filter(Boolean);
    if (parts.length) lines.push(`${label}: ${parts.join(", ")}.`);
  };
  period("Last full week", s.week);
  period("Last month", s.month);
  if (!lines.length) return null;
  return { source: "finance", kind: "daily", day, title: "Finance", lines, link: "https://finance.mailbakes.com" };
}

/** Operations /api/v1/summary: { production_today, stock_items_low, waste } */
export function operationsDebrief(summary: unknown, day: string): DebriefInput | null {
  const s = summary as Record<string, unknown> | null;
  if (!s) return null;
  const made = count(s.production_today);
  const low = count(s.stock_items_low);
  const waste = count(s.waste);
  if (made == null && low == null && waste == null) return null;
  const lines: string[] = [];
  if (made != null) lines.push(made > 0 ? `${plural(made, "cake")} made today.` : "No production logged yet today.");
  if (low != null) lines.push(low > 0 ? `${plural(low, "stock item")} below reorder level.` : "No stock below reorder level.");
  if (waste != null && waste > 0) lines.push(`${plural(waste, "item")} of waste logged.`);
  return { source: "operations", kind: "daily", day, title: "Operations", lines, link: "https://operations.mailbakes.com" };
}

/** Organic /api/v1/summary: { awaiting_approval, approved_this_week, scheduled_next_7_days } */
export function organicDebrief(summary: unknown, day: string): DebriefInput | null {
  const s = summary as Record<string, unknown> | null;
  if (!s) return null;
  const waiting = count(s.awaiting_approval);
  const approved = count(s.approved_this_week);
  const scheduled = count(s.scheduled_next_7_days);
  if (waiting == null && approved == null && scheduled == null) return null;
  const lines: string[] = [];
  if (waiting != null) lines.push(waiting > 0 ? `${plural(waiting, "post")} waiting for your approval.` : "Nothing waiting for approval.");
  if (scheduled != null) lines.push(`${plural(scheduled, "post")} planned for the next 7 days.`);
  if (approved != null) lines.push(`${plural(approved, "post")} approved this week.`);
  return { source: "organic", kind: "daily", day, title: "Organic", lines, link: "https://organic.mailbakes.com" };
}

/** Conversion /api/v1/summary: { running: {...} | null, last_finished, ideas, next } */
export function conversionDebrief(summary: unknown, day: string): DebriefInput | null {
  const s = summary as {
    running?: { name?: string; day?: number; total_days?: number; lift_pct?: number | null; confidence_pct?: number | null; verdict?: string } | null;
    last_finished?: { name?: string; winner?: string | null; lift_pct?: number | null } | null;
    ideas?: number;
    next?: number;
  } | null;
  if (!s) return null;
  const lines: string[] = [];
  if (s.running?.name) {
    const r = s.running;
    const lift = r.lift_pct == null ? "" : `, B ${r.lift_pct >= 0 ? "+" : ""}${r.lift_pct}%`;
    const sure = r.confidence_pct == null ? "" : `, ${r.confidence_pct}% sure`;
    lines.push(`Running: ${r.name}. Day ${r.day ?? "?"} of ${r.total_days ?? 7}${lift}${sure}.`);
    if (r.verdict) lines.push(r.verdict + ".");
  } else {
    lines.push("No test running. Start the next one.");
  }
  if (s.last_finished?.name) {
    const f = s.last_finished;
    const lift = f.lift_pct == null ? "" : ` (B ${f.lift_pct >= 0 ? "+" : ""}${f.lift_pct}%)`;
    lines.push(`Last result: ${f.name}, ${f.winner === "B" ? "B won" : f.winner === "A" ? "kept A" : "no clear winner"}${lift}.`);
  }
  const ideas = count(s.ideas);
  if (ideas != null) lines.push(`${plural(ideas, "idea")} waiting${count(s.next) ? `, ${count(s.next)} lined up next` : ""}.`);
  return { source: "conversion", kind: "daily", day, title: "Conversion", lines, link: "https://conversion.mailbakes.com" };
}

/** Which unticked items move to today: anything not done from an earlier day. */
export function shouldCarry(item: { day: string; done: boolean }, today: string) {
  return !item.done && item.day < today;
}
