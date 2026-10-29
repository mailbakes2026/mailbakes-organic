import { Prisma } from "@prisma/client";
import { listAppointments, type AppointmentDto } from "@/lib/appointments";
import { formatDateOnly, londonToday, parseDateOnly } from "@/lib/dates";
import {
  cleanDay,
  cleanDebrief,
  cleanItemText,
  cleanNote,
  DiaryError,
  type DebriefInput,
  type DebriefSource,
} from "@/lib/diary-rules";
import { prisma } from "@/lib/prisma";
import { listReminders } from "@/lib/records";
import { ValidationError } from "@/lib/shapes";

export type DiaryItemDto = {
  id: string;
  day: string;
  text: string;
  done: boolean;
  carriedFrom: string | null;
};

export type DebriefDto = {
  id: string;
  source: DebriefSource;
  kind: string;
  title: string;
  lines: string[];
  link: string;
  receivedAt: string;
};

export type DiaryReminder = { id: string; title: string; notes: string; dueOn: string; overdue: boolean };

export type DiaryDay = {
  day: string;
  today: string;
  items: DiaryItemDto[];
  note: string;
  reminders: DiaryReminder[];
  appointments: AppointmentDto[];
  debriefs: DebriefDto[];
};

function checked<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof DiaryError) throw new ValidationError(error.message);
    throw error;
  }
}

function dateOf(day: string) {
  return parseDateOnly(day)!;
}

function itemDto(row: { id: string; day: Date; text: string; doneAt: Date | null; carriedFrom: Date | null }): DiaryItemDto {
  return {
    id: row.id,
    day: formatDateOnly(row.day),
    text: row.text,
    done: Boolean(row.doneAt),
    carriedFrom: row.carriedFrom ? formatDateOnly(row.carriedFrom) : null,
  };
}

function debriefDto(row: Prisma.DebriefGetPayload<object>): DebriefDto {
  return {
    id: row.id,
    source: row.source as DebriefSource,
    kind: row.kind,
    title: row.title,
    lines: Array.isArray(row.lines) ? (row.lines as unknown[]).map(String) : [],
    link: row.link,
    receivedAt: row.receivedAt.toISOString(),
  };
}

/** Move every unticked line from an earlier day onto today, remembering where it started. */
export async function carryOverTo(today: string) {
  const stale = await prisma.diaryItem.findMany({ where: { doneAt: null, day: { lt: dateOf(today) } } });
  for (const row of stale) {
    await prisma.diaryItem.update({
      where: { id: row.id },
      data: { day: dateOf(today), carriedFrom: row.carriedFrom ?? row.day },
    });
  }
  return stale.length;
}

export async function loadDiaryDay(dayInput: string, now = new Date()): Promise<DiaryDay> {
  const today = londonToday(now);
  const day = checked(() => cleanDay(dayInput));
  if (day >= today) await carryOverTo(today);

  const [items, note, reminders, appointments, debriefs] = await Promise.all([
    prisma.diaryItem.findMany({ where: { day: dateOf(day) }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.diaryNote.findUnique({ where: { day: dateOf(day) } }),
    listReminders(),
    listAppointments({ from: day, to: day }).catch(() => [] as AppointmentDto[]),
    prisma.debrief.findMany({ where: { day: dateOf(day) }, orderBy: { source: "asc" } }),
  ]);

  // Today shows everything due up to today that isn't ticked; other days show what was due that day.
  const dueHere = reminders
    .filter((r) => !r.done && (day === today ? r.dueOn <= today : r.dueOn === day))
    .filter((r) => !(r.snoozedUntil && Date.parse(r.snoozedUntil) > now.getTime() && day === today))
    .map((r) => ({ id: r.id, title: r.title, notes: r.notes, dueOn: r.dueOn, overdue: r.dueOn < today }));

  return {
    day,
    today,
    items: items.map(itemDto),
    note: note?.body ?? "",
    reminders: dueHere,
    appointments,
    debriefs: debriefs.map(debriefDto),
  };
}

export async function addDiaryItem(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const day = checked(() => cleanDay(body.day));
  const text = checked(() => cleanItemText(body.text));
  const last = await prisma.diaryItem.findFirst({ where: { day: dateOf(day) }, orderBy: { position: "desc" } });
  const row = await prisma.diaryItem.create({ data: { day: dateOf(day), text, position: (last?.position ?? 0) + 1 } });
  return itemDto(row);
}

export async function updateDiaryItem(id: string, input: unknown, now = new Date()) {
  const body = (input ?? {}) as Record<string, unknown>;
  const data: Prisma.DiaryItemUpdateInput = {};
  if ("text" in body) data.text = checked(() => cleanItemText(body.text));
  if ("done" in body) {
    if (typeof body.done !== "boolean") throw new ValidationError("done must be true or false.");
    data.doneAt = body.done ? now : null;
  }
  if ("day" in body) data.day = dateOf(checked(() => cleanDay(body.day)));
  if (!Object.keys(data).length) throw new ValidationError("Nothing to update.");
  try {
    return itemDto(await prisma.diaryItem.update({ where: { id }, data }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
    throw error;
  }
}

export async function deleteDiaryItem(id: string) {
  const result = await prisma.diaryItem.deleteMany({ where: { id } });
  return result.count === 1;
}

export async function saveDiaryNote(dayInput: string, input: unknown) {
  const day = checked(() => cleanDay(dayInput));
  const body = checked(() => cleanNote((input as Record<string, unknown> | null)?.body));
  const row = await prisma.diaryNote.upsert({
    where: { day: dateOf(day) },
    create: { day: dateOf(day), body },
    update: { body },
  });
  return { day, body: row.body, updatedAt: row.updatedAt.toISOString() };
}

/** Save a debrief; a newer one for the same source, kind and day replaces the older. */
export async function saveDebrief(debrief: DebriefInput) {
  const row = await prisma.debrief.upsert({
    where: { source_kind_day: { source: debrief.source, kind: debrief.kind, day: dateOf(debrief.day) } },
    create: {
      source: debrief.source,
      kind: debrief.kind,
      day: dateOf(debrief.day),
      title: debrief.title,
      lines: debrief.lines,
      link: debrief.link,
    },
    update: { title: debrief.title, lines: debrief.lines, link: debrief.link, receivedAt: new Date() },
  });
  return debriefDto(row);
}

export async function receiveDebrief(input: unknown, now = new Date()) {
  return saveDebrief(checked(() => cleanDebrief(input, londonToday(now))));
}

export async function listDebriefs(dayInput: string) {
  const day = checked(() => cleanDay(dayInput));
  const rows = await prisma.debrief.findMany({ where: { day: dateOf(day) }, orderBy: { source: "asc" } });
  return rows.map(debriefDto);
}
