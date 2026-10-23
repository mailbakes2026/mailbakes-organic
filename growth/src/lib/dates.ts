export function formatDateOnly(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export function addDays(day: string, days: number) {
  const parsed = parseDateOnly(day);
  if (!parsed) return day;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatDateOnly(parsed);
}

export function londonToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function londonWeekStart(now = new Date()) {
  const today = londonToday(now);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
  }).format(now);
  const index = WEEKDAYS.indexOf(weekday);
  if (index < 0) return today;
  return addDays(today, -index);
}

export function mondayOf(day: string) {
  const parsed = parseDateOnly(day);
  if (!parsed) return day;
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
  }).format(parsed);
  const index = WEEKDAYS.indexOf(weekday);
  if (index < 0) return day;
  return addDays(day, -index);
}

export function eachDate(from: string, to: string) {
  const out: string[] = [];
  if (!parseDateOnly(from) || !parseDateOnly(to) || from > to) return out;
  let cursor = from;
  while (cursor <= to && out.length < 400) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function formatDay(day: string) {
  const parsed = parseDateOnly(day);
  if (!parsed) return day;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function formatLondon(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

export function monthKey(day: string) {
  return day.slice(0, 7);
}

export function addMonths(month: string, count: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + count, 1));
  const year = date.getUTCFullYear();
  const next = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${next}`;
}

export function formatMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "numeric" }).format(date);
}
