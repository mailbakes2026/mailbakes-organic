import { addDays, formatLondonTime, londonDateTime, londonParts, londonToday } from "@/lib/dates";
import { getAccessToken, laneForCalendar, ReconnectError } from "@/lib/google";

const CALENDAR = "https://www.googleapis.com/calendar/v3";

export type CalendarItem = {
  id: string;
  title: string;
  lane: "mailbakes" | "personal";
  calendar: string;
  allDay: boolean;
  day: string;
  timeLabel: string;
  location: string;
  joinUrl: string;
  openUrl: string;
  happening: boolean;
  startMs: number;
};

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

async function calendarFetch(token: string, path: string) {
  const response = await fetch(`${CALENDAR}${path}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) {
    if (response.status === 401) throw new ReconnectError("Google needs connecting again.");
    throw new Error(body.error?.message || `Google Calendar returned ${response.status}.`);
  }
  return body;
}

function dayKey(iso: string) {
  const parts = londonParts(new Date(iso));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export async function loadUpcoming(now = new Date()): Promise<{ events: CalendarItem[]; warnings: string[] }> {
  const token = await getAccessToken();
  const list = (await calendarFetch(token, "/users/me/calendarList?minAccessRole=reader")) as {
    items?: { id: string; summary?: string; primary?: boolean; selected?: boolean }[];
  };
  const calendars = (list.items ?? []).filter((item) => item.selected !== false).slice(0, 15);
  const timeMin = new Date(now.getTime() - 60_000).toISOString();
  const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const today = londonToday(now);
  const events: CalendarItem[] = [];
  const warnings: string[] = [];
  for (const calendar of calendars) {
    try {
      const data = (await calendarFetch(
        token,
        `/calendars/${encodeURIComponent(calendar.id)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=40`,
      )) as { items?: GoogleEvent[] };
      const name = calendar.summary || (calendar.primary ? "Primary" : "Calendar");
      for (const event of data.items ?? []) {
        if (event.status === "cancelled") continue;
        const item = toItem(event, name, now, today);
        if (item) events.push(item);
      }
    } catch (error) {
      if (error instanceof ReconnectError) throw error;
      warnings.push(calendar.summary || calendar.id);
      console.error(error);
    }
  }
  events.sort((a, b) => a.startMs - b.startMs);
  return { events, warnings };
}

function toItem(event: GoogleEvent, calendar: string, now: Date, today: string): CalendarItem | null {
  const title = event.summary?.trim() || "(No title)";
  const lane = laneForCalendar(calendar);
  if (event.start?.date) {
    const start = event.start.date;
    const end = event.end?.date || start;
    if (end <= today && start !== today) return null;
    const happening = start <= today && today < end;
    return {
      id: `${calendar}:${event.id || title}:${start}`,
      title,
      lane,
      calendar,
      allDay: true,
      day: start,
      timeLabel: "All day",
      location: event.location?.trim() || "",
      joinUrl: event.hangoutLink || "",
      openUrl: event.htmlLink || "",
      happening,
      startMs: Date.parse(`${start}T00:00:00Z`),
    };
  }
  if (!event.start?.dateTime) return null;
  const startIso = event.start.dateTime;
  const endIso = event.end?.dateTime || new Date(Date.parse(startIso) + 60 * 60 * 1000).toISOString();
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (Number.isNaN(startMs) || endMs <= now.getTime()) return null;
  const happening = startMs <= now.getTime() && now.getTime() < endMs;
  return {
    id: `${calendar}:${event.id || title}:${startIso}`,
    title,
    lane,
    calendar,
    allDay: false,
    day: dayKey(startIso),
    timeLabel: `${formatLondonTime(startIso)}–${formatLondonTime(endIso)}`,
    location: event.location?.trim() || "",
    joinUrl: event.hangoutLink || "",
    openUrl: event.htmlLink || "",
    happening,
    startMs,
  };
}

/** A Google event placed on the week grid. Read-only: the app never writes to Google. */
export type GoogleWeekItem = {
  id: string;
  title: string;
  calendar: string;
  lane: "mailbakes" | "personal";
  allDay: boolean;
  startDay: string;
  /** Last day covered, inclusive. */
  endDay: string;
  startTime: string;
  endTime: string;
  location: string;
  openUrl: string;
};

function hhmm(iso: string) {
  const parts = londonParts(new Date(iso));
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function toWeekItem(event: GoogleEvent, calendar: string): GoogleWeekItem | null {
  const title = event.summary?.trim() || "(No title)";
  const base = {
    title,
    calendar,
    lane: laneForCalendar(calendar),
    location: event.location?.trim() || "",
    openUrl: event.htmlLink || "",
  };
  if (event.start?.date) {
    const startDay = event.start.date;
    // Google's all-day end date is the day after the last day.
    const endDay = event.end?.date && event.end.date > startDay ? addDays(event.end.date, -1) : startDay;
    return { ...base, id: `g:${calendar}:${event.id || title}:${startDay}`, allDay: true, startDay, endDay, startTime: "", endTime: "" };
  }
  if (!event.start?.dateTime) return null;
  const startIso = event.start.dateTime;
  const endIso = event.end?.dateTime || new Date(Date.parse(startIso) + 60 * 60 * 1000).toISOString();
  if (Number.isNaN(Date.parse(startIso))) return null;
  const startDay = dayKey(startIso);
  const endDayKey = dayKey(endIso);
  let endTime = hhmm(endIso);
  // An event running past midnight is drawn to the end of its first day.
  if (endDayKey !== startDay) endTime = "23:59";
  const startTime = hhmm(startIso);
  if (endTime <= startTime) endTime = "23:59";
  return { ...base, id: `g:${calendar}:${event.id || title}:${startIso}`, allDay: false, startDay, endDay: startDay, startTime, endTime };
}

/** Google events touching `fromDay`..`toDay` (inclusive, London dates). */
export async function loadGoogleRange(fromDay: string, toDay: string): Promise<{ events: GoogleWeekItem[]; warnings: string[] }> {
  const token = await getAccessToken();
  const list = (await calendarFetch(token, "/users/me/calendarList?minAccessRole=reader")) as {
    items?: { id: string; summary?: string; primary?: boolean; selected?: boolean }[];
  };
  const calendars = (list.items ?? []).filter((item) => item.selected !== false).slice(0, 15);
  const timeMin = londonDateTime(fromDay, 0).toISOString();
  const timeMax = londonDateTime(addDays(toDay, 1), 0).toISOString();
  const events: GoogleWeekItem[] = [];
  const warnings: string[] = [];
  for (const calendar of calendars) {
    try {
      const data = (await calendarFetch(
        token,
        `/calendars/${encodeURIComponent(calendar.id)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=250`,
      )) as { items?: GoogleEvent[] };
      const name = calendar.summary || (calendar.primary ? "Primary" : "Calendar");
      for (const event of data.items ?? []) {
        if (event.status === "cancelled") continue;
        const item = toWeekItem(event, name);
        if (item && item.endDay >= fromDay && item.startDay <= toDay) events.push(item);
      }
    } catch (error) {
      if (error instanceof ReconnectError) throw error;
      warnings.push(calendar.summary || calendar.id);
      console.error(error);
    }
  }
  return { events, warnings };
}
