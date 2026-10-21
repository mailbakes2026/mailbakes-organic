import { Prisma, type RunStatus } from "@prisma/client";
import { formatDateOnly, londonToday, parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { asRecord, cleanDueOn, cleanSnooze, cleanText, cleanUrl, parseStatus, statusLabel, ValidationError } from "@/lib/shapes";

function missing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function reminderDto(row: {
  id: string;
  title: string;
  notes: string;
  dueOn: Date;
  doneAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueOn: formatDateOnly(row.dueOn),
    done: Boolean(row.doneAt),
    doneAt: iso(row.doneAt),
    snoozedUntil: iso(row.snoozedUntil),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function itemDto(row: {
  id: string;
  title: string;
  status: RunStatus;
  notes: string;
  emailUrl: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    status: statusLabel(row.status),
    notes: row.notes,
    emailUrl: row.emailUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function briefingDto(row: {
  id: string;
  date: Date;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    date: formatDateOnly(row.date),
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listReminders() {
  const rows = await prisma.reminder.findMany();
  rows.sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime() || a.title.localeCompare(b.title));
  return rows.map(reminderDto);
}

export async function getReminder(id: string) {
  const row = await prisma.reminder.findUnique({ where: { id } });
  if (!row) return null;
  return reminderDto(row);
}

export async function createReminder(input: unknown, now = new Date()) {
  const body = asRecord(input);
  const due = body.dueOn == null || body.dueOn === "" ? parseDateOnly(londonToday(now))! : cleanDueOn(body.dueOn);
  const snooze = cleanSnooze(body, now);
  const row = await prisma.reminder.create({
    data: {
      title: cleanText(body.title, "title", 200, true),
      notes: cleanText(body.notes, "Notes", 8000, false),
      dueOn: due,
      snoozedUntil: snooze ?? null,
    },
  });
  return reminderDto(row);
}

export async function updateReminder(id: string, input: unknown, now = new Date()) {
  const body = asRecord(input);
  const data: Prisma.ReminderUpdateInput = {};
  if ("title" in body) data.title = cleanText(body.title, "title", 200, true);
  if ("notes" in body) data.notes = cleanText(body.notes, "Notes", 8000, false);
  if ("dueOn" in body) data.dueOn = cleanDueOn(body.dueOn);
  if ("done" in body) {
    if (typeof body.done !== "boolean") throw new ValidationError("Done must be true or false.");
    data.doneAt = body.done ? now : null;
  }
  const snooze = cleanSnooze(body, now);
  if (snooze !== undefined) data.snoozedUntil = snooze;
  if (Object.keys(data).length === 0) throw new ValidationError("Nothing to update.");
  try {
    const row = await prisma.reminder.update({ where: { id }, data });
    return reminderDto(row);
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

export async function deleteReminder(id: string) {
  try {
    await prisma.reminder.delete({ where: { id } });
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
}

const STATUS_RANK: Record<RunStatus, number> = { WAITING: 0, NEEDS_MILLIE: 1, DONE: 2 };

export async function listItems() {
  const rows = await prisma.runItem.findMany();
  rows.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.updatedAt.getTime() - a.updatedAt.getTime());
  return rows.map(itemDto);
}

export async function getItem(id: string) {
  const row = await prisma.runItem.findUnique({ where: { id } });
  if (!row) return null;
  return itemDto(row);
}

export async function createItem(input: unknown) {
  const body = asRecord(input);
  const status = body.status == null || body.status === "" ? "WAITING" : parseStatus(body.status);
  if (!status) throw new ValidationError("Status must be waiting, needs Millie, or done.");
  const row = await prisma.runItem.create({
    data: {
      title: cleanText(body.title, "title", 200, true),
      notes: cleanText(body.notes, "Notes", 8000, false),
      emailUrl: cleanUrl(body.emailUrl),
      status,
    },
  });
  return itemDto(row);
}

export async function updateItem(id: string, input: unknown) {
  const body = asRecord(input);
  const data: Prisma.RunItemUpdateInput = {};
  if ("title" in body) data.title = cleanText(body.title, "title", 200, true);
  if ("notes" in body) data.notes = cleanText(body.notes, "Notes", 8000, false);
  if ("emailUrl" in body) data.emailUrl = cleanUrl(body.emailUrl);
  if ("status" in body) {
    const status = parseStatus(body.status);
    if (!status) throw new ValidationError("Status must be waiting, needs Millie, or done.");
    data.status = status;
  }
  if (Object.keys(data).length === 0) throw new ValidationError("Nothing to update.");
  try {
    const row = await prisma.runItem.update({ where: { id }, data });
    return itemDto(row);
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

export async function deleteItem(id: string) {
  try {
    await prisma.runItem.delete({ where: { id } });
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
}

export async function listBriefings() {
  const rows = await prisma.briefing.findMany();
  rows.sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
  return rows.map(briefingDto);
}

export async function getBriefing(id: string) {
  const row = await prisma.briefing.findUnique({ where: { id } });
  if (!row) return null;
  return briefingDto(row);
}

export async function createBriefing(input: unknown, now = new Date()) {
  const body = asRecord(input);
  const date = body.date == null || body.date === "" ? parseDateOnly(londonToday(now))! : cleanDueOn(body.date);
  const row = await prisma.briefing.create({
    data: {
      date,
      title: cleanText(body.title, "title", 200, false),
      body: cleanText(body.body, "briefing", 20000, true),
    },
  });
  return briefingDto(row);
}

export async function updateBriefing(id: string, input: unknown) {
  const body = asRecord(input);
  const data: Prisma.BriefingUpdateInput = {};
  if ("date" in body) data.date = cleanDueOn(body.date);
  if ("title" in body) data.title = cleanText(body.title, "title", 200, false);
  if ("body" in body) data.body = cleanText(body.body, "briefing", 20000, true);
  if (Object.keys(data).length === 0) throw new ValidationError("Nothing to update.");
  try {
    const row = await prisma.briefing.update({ where: { id }, data });
    return briefingDto(row);
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

export async function deleteBriefing(id: string) {
  try {
    await prisma.briefing.delete({ where: { id } });
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
}
