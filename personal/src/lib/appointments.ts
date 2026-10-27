import { Prisma, type AppointmentReminder, type AppointmentType } from "@prisma/client";
import {
  AppointmentError,
  cleanAppointment,
  dueReminders,
  remindersNeedReset,
  startInstant,
  type AppointmentTypeLabel,
  type CleanAppointment,
  type ReminderKind,
  type ReminderLabel,
} from "@/lib/appointment-rules";
import { addDays, formatDateOnly, formatLongLondonDate, londonToday, parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/shapes";

type Row = Prisma.AppointmentGetPayload<object>;

const TYPE_TO_DB: Record<AppointmentTypeLabel, AppointmentType> = {
  Hair: "HAIR",
  Aesthetics: "AESTHETICS",
  Work: "WORK",
  Meeting: "MEETING",
  Meal: "MEAL",
  Party: "PARTY",
  Dinner: "DINNER",
  Travel: "TRAVEL",
  Other: "OTHER",
};
const TYPE_FROM_DB = Object.fromEntries(Object.entries(TYPE_TO_DB).map(([label, db]) => [db, label])) as Record<
  AppointmentType,
  AppointmentTypeLabel
>;

const REMINDER_TO_DB: Record<ReminderLabel, AppointmentReminder> = {
  none: "NONE",
  morning: "MORNING",
  "day-before": "DAY_BEFORE",
  both: "BOTH",
};
const REMINDER_FROM_DB = Object.fromEntries(Object.entries(REMINDER_TO_DB).map(([label, db]) => [db, label])) as Record<
  AppointmentReminder,
  ReminderLabel
>;

export type AppointmentDto = CleanAppointment & { id: string; createdAt: string; updatedAt: string };

/** Turn rule errors into the app's 400 error, so the board router answers clearly. */
function checked<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof AppointmentError) throw new ValidationError(error.message);
    throw error;
  }
}

function missing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function toClean(row: Row): CleanAppointment {
  return {
    title: row.title,
    type: TYPE_FROM_DB[row.type],
    startDay: formatDateOnly(row.startDay),
    endDay: formatDateOnly(row.endDay),
    allDay: row.allDay,
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location,
    notes: row.notes,
    reminder: REMINDER_FROM_DB[row.reminder],
  };
}

function toDto(row: Row): AppointmentDto {
  return { id: row.id, ...toClean(row), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function toData(clean: CleanAppointment) {
  return {
    title: clean.title,
    type: TYPE_TO_DB[clean.type],
    startDay: parseDateOnly(clean.startDay)!,
    endDay: parseDateOnly(clean.endDay)!,
    allDay: clean.allDay,
    startTime: clean.startTime,
    endTime: clean.endTime,
    location: clean.location,
    notes: clean.notes,
    reminder: REMINDER_TO_DB[clean.reminder],
  };
}

function sortRows(rows: Row[]) {
  return rows.sort(
    (a, b) =>
      a.startDay.getTime() - b.startDay.getTime() ||
      Number(b.allDay) - Number(a.allDay) ||
      a.startTime.localeCompare(b.startTime) ||
      a.title.localeCompare(b.title),
  );
}

/** Appointments touching any day from `from` to `to` (both YYYY-MM-DD, inclusive). */
export async function listAppointments(range?: { from?: string | null; to?: string | null }) {
  const where: Prisma.AppointmentWhereInput = {};
  const from = range?.from ? parseDateOnly(range.from) : null;
  const to = range?.to ? parseDateOnly(range.to) : null;
  if (range?.from && !from) throw new ValidationError("from must be YYYY-MM-DD.");
  if (range?.to && !to) throw new ValidationError("to must be YYYY-MM-DD.");
  if (from) where.endDay = { gte: from };
  if (to) where.startDay = { lte: to };
  const rows = await prisma.appointment.findMany({ where });
  return sortRows(rows).map(toDto);
}

export async function getAppointment(id: string) {
  const row = await prisma.appointment.findUnique({ where: { id } });
  return row ? toDto(row) : null;
}

export async function createAppointment(input: unknown) {
  const clean = checked(() => cleanAppointment(input));
  const row = await prisma.appointment.create({ data: toData(clean) });
  return toDto(row);
}

export async function updateAppointment(id: string, input: unknown) {
  const row = await prisma.appointment.findUnique({ where: { id } });
  if (!row) return null;
  const before = toClean(row);
  const after = checked(() => cleanAppointment(input, before));
  const data: Prisma.AppointmentUpdateInput = toData(after);
  if (remindersNeedReset(before, after)) {
    data.morningSentAt = null;
    data.dayBeforeSentAt = null;
  }
  try {
    return toDto(await prisma.appointment.update({ where: { id }, data }));
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

export async function deleteAppointment(id: string) {
  try {
    await prisma.appointment.delete({ where: { id } });
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
}

export const MAX_IMPORT = 200;

/**
 * Bulk add, for loading a saved list. Body: { appointments: [...] }.
 * Every row is checked first; if any is wrong nothing is saved and the answer
 * says which row. A row matching one already saved (same title, start date and
 * start time) is skipped, so running the import twice does not double up.
 */
export async function importAppointments(input: unknown) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const list = body.appointments;
  if (!Array.isArray(list) || list.length === 0) {
    throw new ValidationError("Send { appointments: [...] } with at least one appointment.");
  }
  if (list.length > MAX_IMPORT) throw new ValidationError(`Send at most ${MAX_IMPORT} at a time.`);
  const cleaned = list.map((item, index) => {
    try {
      return cleanAppointment(item);
    } catch (error) {
      if (error instanceof AppointmentError) throw new ValidationError(`Row ${index + 1}: ${error.message}`);
      throw error;
    }
  });

  return prisma.$transaction(async (tx) => {
    const created: AppointmentDto[] = [];
    let skipped = 0;
    for (const clean of cleaned) {
      const data = toData(clean);
      const existing = await tx.appointment.findFirst({
        where: { title: data.title, startDay: data.startDay, startTime: data.startTime },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      created.push(toDto(await tx.appointment.create({ data })));
    }
    return { created, skipped };
  });
}

/** Appointments with a reminder that might be due (today or tomorrow). */
async function reminderCandidates(today: Date, tomorrow: Date) {
  return prisma.appointment.findMany({
    where: { reminder: { not: "NONE" }, startDay: { gte: today, lte: tomorrow } },
  });
}

export type ReminderToSend = { row: Row; clean: CleanAppointment; kind: ReminderKind };

export async function findDueReminders(now = new Date()): Promise<ReminderToSend[]> {
  const today = londonToday(now);
  const rows = await reminderCandidates(parseDateOnly(today)!, parseDateOnly(addDays(today, 1))!);
  const due: ReminderToSend[] = [];
  for (const row of rows) {
    const clean = toClean(row);
    for (const kind of dueReminders({ ...clean, morningSentAt: row.morningSentAt, dayBeforeSentAt: row.dayBeforeSentAt }, now)) {
      due.push({ row, clean, kind });
    }
  }
  due.sort((a, b) => startInstant(a.clean).getTime() - startInstant(b.clean).getTime());
  return due;
}

/** Mark sent only if nobody else did in the meantime, so two runs never send twice. */
export async function claimReminder(id: string, kind: ReminderKind, now = new Date()) {
  const field = kind === "morning" ? "morningSentAt" : "dayBeforeSentAt";
  const result = await prisma.appointment.updateMany({ where: { id, [field]: null }, data: { [field]: now } });
  return result.count === 1;
}

export async function releaseReminder(id: string, kind: ReminderKind) {
  const field = kind === "morning" ? "morningSentAt" : "dayBeforeSentAt";
  await prisma.appointment.updateMany({ where: { id }, data: { [field]: null } });
}

export function describeWhen(clean: CleanAppointment) {
  const first = formatLongLondonDate(clean.startDay);
  if (clean.allDay) {
    return clean.endDay === clean.startDay ? `${first}, all day` : `${first} to ${formatLongLondonDate(clean.endDay)}`;
  }
  return `${first}, ${clean.startTime}–${clean.endTime}`;
}
