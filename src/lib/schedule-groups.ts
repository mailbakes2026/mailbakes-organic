export type ScheduleItem = {
  plannedDate: string;
  plannedTime?: string | null;
  createdAt?: string;
};

export type ScheduleGroup<T> = {
  id: string;
  heading: string;
  past: boolean;
  items: T[];
};

export function londonCivilDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function civilDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dayMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(civilDate(iso));
}

export function scheduleHeading(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === shiftDate(today, 1)) return "Tomorrow";
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  }).format(civilDate(date));
  return `${weekday} ${dayMonth(date)}`;
}

export function scheduleBadge(date: string, now: Date): string {
  const today = londonCivilDate(now);
  if (date === today) return "Today";
  if (date === shiftDate(today, 1)) return "Tomorrow";
  return dayMonth(date);
}

function timeKey(time: string | null | undefined) {
  const value = time?.trim();
  return value ? value : "99:99";
}

export function compareSoonest<T extends ScheduleItem>(a: T, b: T): number {
  return (
    a.plannedDate.localeCompare(b.plannedDate) ||
    timeKey(a.plannedTime).localeCompare(timeKey(b.plannedTime)) ||
    (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
  );
}

export function groupBySchedule<T extends ScheduleItem>(items: T[], now: Date): ScheduleGroup<T>[] {
  const today = londonCivilDate(now);
  const sorted = [...items].sort(compareSoonest);
  const upcoming = new Map<string, T[]>();
  const past: T[] = [];
  for (const item of sorted) {
    if (item.plannedDate < today) {
      past.push(item);
      continue;
    }
    const list = upcoming.get(item.plannedDate);
    if (list) list.push(item);
    else upcoming.set(item.plannedDate, [item]);
  }
  const groups: ScheduleGroup<T>[] = [];
  for (const [date, groupItems] of upcoming) {
    groups.push({
      id: date,
      heading: scheduleHeading(date, today),
      past: false,
      items: groupItems,
    });
  }
  if (past.length > 0) {
    groups.push({ id: "past", heading: "Past", past: true, items: past });
  }
  return groups;
}
