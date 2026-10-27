// Pure rules for Millie's own appointments: checking input, and working out
// when an email reminder is due. No database here, so it can be unit tested.
import { addDays, londonDateTime, londonParts, londonToday, parseDateOnly } from "./dates.ts";

export class AppointmentError extends Error {}

export const APPOINTMENT_TYPES = [
  "Hair",
  "Aesthetics",
  "Work",
  "Meeting",
  "Meal",
  "Party",
  "Dinner",
  "Travel",
  "Other",
] as const;
export type AppointmentTypeLabel = (typeof APPOINTMENT_TYPES)[number];

export const REMINDERS = ["none", "morning", "day-before", "both"] as const;
export type ReminderLabel = (typeof REMINDERS)[number];

/** Longest multi-day booking allowed, so a typo in the year can't make a 10-year bar. */
export const MAX_SPAN_DAYS = 62;

/** Morning-of reminders go at 07:00, day-before reminders at 18:00, London time. */
export const MORNING_HOUR = 7;
export const DAY_BEFORE_HOUR = 18;

export type CleanAppointment = {
  title: string;
  type: AppointmentTypeLabel;
  startDay: string;
  endDay: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  reminder: ReminderLabel;
};

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppointmentError("Send a JSON object.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, required: boolean) {
  if (value == null || value === "") {
    if (required) throw new AppointmentError(`Add a ${label}.`);
    return "";
  }
  if (typeof value !== "string") throw new AppointmentError(`The ${label} must be text.`);
  const trimmed = value.trim();
  if (!trimmed && required) throw new AppointmentError(`Add a ${label}.`);
  if (trimmed.length > max) throw new AppointmentError(`The ${label} is too long.`);
  return trimmed;
}

function day(value: unknown, label: string) {
  if (typeof value !== "string" || !parseDateOnly(value.trim())) {
    throw new AppointmentError(`The ${label} must be a date (YYYY-MM-DD).`);
  }
  return value.trim();
}

/** "9:5" is rejected; "09:05" and "9:05" are fine. Returns "HH:MM". */
export function cleanTime(value: unknown, label: string) {
  if (typeof value !== "string") throw new AppointmentError(`Add a ${label} time.`);
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new AppointmentError(`The ${label} time must look like 14:30.`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new AppointmentError(`The ${label} time must look like 14:30.`);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function minutesOf(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function parseType(value: unknown): AppointmentTypeLabel {
  if (value == null || value === "") return "Other";
  if (typeof value !== "string") throw new AppointmentError("The type must be text.");
  const found = APPOINTMENT_TYPES.find((type) => type.toLowerCase() === value.trim().toLowerCase());
  if (!found) throw new AppointmentError(`The type must be one of: ${APPOINTMENT_TYPES.join(", ")}.`);
  return found;
}

export function parseReminder(value: unknown): ReminderLabel {
  if (value == null || value === "") return "none";
  if (typeof value !== "string") throw new AppointmentError("The reminder must be text.");
  const key = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const found = REMINDERS.find((reminder) => reminder === key);
  if (!found) throw new AppointmentError("The reminder must be none, morning, day-before or both.");
  return found;
}

function daysBetween(from: string, to: string) {
  return Math.round((parseDateOnly(to)!.getTime() - parseDateOnly(from)!.getTime()) / 86_400_000);
}

/**
 * Checks a whole appointment. For an update, pass the saved one as `base` and
 * only the fields sent are changed. An appointment with times is one day long;
 * all-day ones can run across several days.
 */
export function cleanAppointment(input: unknown, base?: CleanAppointment): CleanAppointment {
  const body = record(input);
  const has = (key: string) => key in body;
  const pick = <T,>(key: string, read: (value: unknown) => T, fallback: T | undefined): T => {
    if (has(key) || fallback === undefined) return read(body[key]);
    return fallback;
  };

  const title = pick("title", (value) => text(value, "title", 200, true), base?.title);
  const type = pick("type", parseType, base?.type ?? (has("type") ? undefined : "Other"));
  const startDay = pick("startDay", (value) => day(value, "start date"), base?.startDay);
  const allDay = pick(
    "allDay",
    (value) => {
      if (value == null) return false;
      if (typeof value !== "boolean") throw new AppointmentError("All day must be true or false.");
      return value;
    },
    base?.allDay,
  );
  const location = pick("location", (value) => text(value, "location", 300, false), base?.location ?? "");
  const notes = pick("notes", (value) => text(value, "notes", 4000, false), base?.notes ?? "");
  const reminder = pick("reminder", parseReminder, base?.reminder ?? "none");

  if (allDay) {
    let endDay = startDay;
    if (has("endDay") && body.endDay != null && body.endDay !== "") endDay = day(body.endDay, "end date");
    else if (!has("endDay") && base?.allDay && base.startDay === startDay) endDay = base.endDay;
    else if (!has("endDay") && base?.allDay) endDay = addDays(startDay, daysBetween(base.startDay, base.endDay));
    if (endDay < startDay) throw new AppointmentError("The end date is before the start date.");
    if (daysBetween(startDay, endDay) > MAX_SPAN_DAYS) {
      throw new AppointmentError(`An appointment can cover at most ${MAX_SPAN_DAYS + 1} days.`);
    }
    return { title, type, startDay, endDay, allDay, startTime: "", endTime: "", location, notes, reminder };
  }

  if (has("endDay") && body.endDay != null && body.endDay !== "" && day(body.endDay, "end date") !== startDay) {
    throw new AppointmentError("Only all-day appointments can run over several days.");
  }
  const startTime = pick("startTime", (value) => cleanTime(value, "start"), base?.startTime || undefined);
  let endTime: string;
  if (has("endTime") && body.endTime != null && body.endTime !== "") endTime = cleanTime(body.endTime, "end");
  else if (!has("endTime") && base?.endTime && !has("startTime")) endTime = base.endTime;
  else {
    // No end given: keep the old length when moving a timed appointment,
    // otherwise one hour. Capped at 23:59.
    const length =
      base && !base.allDay && base.startTime && base.endTime ? minutesOf(base.endTime) - minutesOf(base.startTime) : 60;
    const end = Math.min(minutesOf(startTime) + length, 23 * 60 + 59);
    endTime = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  }
  if (minutesOf(endTime) <= minutesOf(startTime)) {
    throw new AppointmentError("The end time must be after the start time.");
  }
  return { title, type, startDay, endDay: startDay, allDay, startTime, endTime, location, notes, reminder };
}

/** Did a change move the appointment or its reminder, so reminders should go again? */
export function remindersNeedReset(before: CleanAppointment, after: CleanAppointment) {
  return (
    before.startDay !== after.startDay ||
    before.startTime !== after.startTime ||
    before.allDay !== after.allDay ||
    before.reminder !== after.reminder
  );
}

export type ReminderKind = "morning" | "day-before";

/**
 * Which reminders are due right now. A reminder is only sent inside its own
 * window, so a missed run never sends a pile of stale emails later:
 * - morning: on the day, from 07:00 until the appointment starts (all-day: until 12:00);
 * - day-before: the day before, from 18:00 until midnight.
 */
export function dueReminders(
  appointment: Pick<CleanAppointment, "startDay" | "allDay" | "startTime" | "reminder"> & {
    morningSentAt: Date | null;
    dayBeforeSentAt: Date | null;
  },
  now = new Date(),
): ReminderKind[] {
  const due: ReminderKind[] = [];
  if (appointment.reminder === "none") return due;
  const today = londonToday(now);
  const wall = londonParts(now);
  const minuteNow = wall.hour * 60 + wall.minute;

  const wantsMorning = appointment.reminder === "morning" || appointment.reminder === "both";
  if (wantsMorning && !appointment.morningSentAt && today === appointment.startDay) {
    const until = appointment.allDay ? 12 * 60 : minutesOf(appointment.startTime);
    if (minuteNow >= MORNING_HOUR * 60 && minuteNow < until) due.push("morning");
  }

  const wantsDayBefore = appointment.reminder === "day-before" || appointment.reminder === "both";
  if (wantsDayBefore && !appointment.dayBeforeSentAt && addDays(today, 1) === appointment.startDay) {
    if (minuteNow >= DAY_BEFORE_HOUR * 60) due.push("day-before");
  }
  return due;
}

/** Start of the appointment as a real instant, for sorting and the email. */
export function startInstant(appointment: Pick<CleanAppointment, "startDay" | "allDay" | "startTime">) {
  if (appointment.allDay) return londonDateTime(appointment.startDay, 0, 0);
  const [hour, minute] = appointment.startTime.split(":").map(Number);
  return londonDateTime(appointment.startDay, hour, minute);
}

/** Monday of the week holding `day` (YYYY-MM-DD). */
export function mondayOf(day: string) {
  const parsed = parseDateOnly(day);
  if (!parsed) return day;
  const back = (parsed.getUTCDay() + 6) % 7;
  return addDays(day, -back);
}
