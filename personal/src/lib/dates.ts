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

export function londonParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const hour = read("hour");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: hour === 24 ? 0 : hour,
    minute: read("minute"),
  };
}

/** 08:00 Europe/London on a calendar day, as a UTC instant. */
export function londonDateTime(day: string, hour: number, minute = 0) {
  const [year, month, date] = day.split("-").map(Number);
  let utc = Date.UTC(year, month - 1, date, hour, minute, 0);
  const wanted = utc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const wall = londonParts(new Date(utc));
    const actual = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);
    const delta = wanted - actual;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

export function snoozePreset(preset: string, now = new Date()): Date | null {
  if (preset === "later") return new Date(now.getTime() + 3 * 60 * 60 * 1000);
  if (preset === "tomorrow") return londonDateTime(addDays(londonToday(now), 1), 8);
  if (preset === "week") return londonDateTime(addDays(londonToday(now), 7), 8);
  return null;
}

export function parseSnoozeInput(value: string, now = new Date()): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (!parseDateOnly(value)) return null;
    return londonDateTime(value, 8);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() < now.getTime() - 60_000) return null;
  return parsed;
}

export function formatLondonWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function londonWeekCommencing(now = new Date()) {
  const parts = londonParts(now);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const weekday = date.getUTCDay();
  const back = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - back);
  return formatDateOnly(date);
}

export function formatLongLondonDate(day: string) {
  const parsed = parseDateOnly(day);
  if (!parsed) return day;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(parsed.getTime() + 12 * 60 * 60 * 1000));
}

export function formatLondonDay(day: string, today = londonToday()) {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  const parsed = parseDateOnly(day);
  if (!parsed) return day;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(parsed.getTime() + 12 * 60 * 60 * 1000));
}

export function formatLondonTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatLondonStamp(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
