import type { NoteStatus, Platform } from "@prisma/client";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/service";
import type { NoteDTO, NoteStatusId, PlatformId, UserDTO } from "@/lib/types";

const PLATFORMS: PlatformId[] = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "YOUTUBE_SHORTS", "SNAPCHAT"];
const STATUSES: NoteStatusId[] = ["IDEA", "PLANNED", "DONE"];
const MAX_IMAGES = 6;
const MAX_LINKS = 8;
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const noteSelect = {
  id: true,
  title: true,
  description: true,
  links: true,
  platform: true,
  date: true,
  doThisWeek: true,
  status: true,
  checked: true,
  postId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { name: true } },
  images: {
    select: { id: true, fileName: true, mimeType: true },
    orderBy: { createdAt: "asc" as const },
  },
};

type NoteRow = {
  id: string;
  title: string;
  description: string;
  links: string[];
  platform: Platform | null;
  date: Date | null;
  doThisWeek: boolean;
  status: NoteStatus;
  checked: boolean;
  postId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { name: string };
  images: { id: string; fileName: string; mimeType: string }[];
};

function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseOptionalDay(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, "Choose a valid date, or leave it blank.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new HttpError(400, "Choose a valid date, or leave it blank.");
  }
  return date;
}

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readLinks(form: FormData) {
  const raw = field(form, "links");
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Couldn't read the links.");
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new HttpError(400, "Couldn't read the links.");
  }
  const links: string[] = [];
  for (const item of parsed) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      throw new HttpError(400, "Use a real link, like https://example.com.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new HttpError(400, "Use a real link, like https://example.com.");
    }
    if (url.toString().length > 500) throw new HttpError(400, "That link is too long.");
    links.push(url.toString());
  }
  if (links.length > MAX_LINKS) throw new HttpError(400, `You can add up to ${MAX_LINKS} links.`);
  return links;
}

function readNoteInput(form: FormData) {
  const title = field(form, "title");
  if (!title || title.length > 140) throw new HttpError(400, "Enter a title, up to 140 characters.");
  const description = field(form, "description");
  if (description.length > 5000) throw new HttpError(400, "Keep the description under 5,000 characters.");
  const platformRaw = field(form, "platform");
  if (platformRaw && !PLATFORMS.includes(platformRaw as PlatformId)) {
    throw new HttpError(400, "Choose a platform, or leave it blank.");
  }
  const status = field(form, "status");
  if (!STATUSES.includes(status as NoteStatusId)) throw new HttpError(400, "Choose idea, planned or done.");
  let removeImageIds: string[] = [];
  const removeRaw = field(form, "removeImageIds");
  if (removeRaw) {
    try {
      const value = JSON.parse(removeRaw);
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error("bad");
      removeImageIds = value;
    } catch {
      throw new HttpError(400, "Couldn't update the pictures.");
    }
  }
  return {
    title,
    description,
    links: readLinks(form),
    platform: (platformRaw || null) as Platform | null,
    date: parseOptionalDay(field(form, "date")),
    doThisWeek: field(form, "doThisWeek") === "true",
    status: status as NoteStatus,
    checked: field(form, "checked") ? field(form, "checked") === "true" : status === "DONE",
    removeImageIds,
  };
}

async function readImages(form: FormData) {
  const entries = form.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
  if (entries.length > MAX_IMAGES) throw new HttpError(400, `You can add up to ${MAX_IMAGES} pictures.`);
  const files: { fileName: string; mimeType: string; sizeBytes: number; data: Uint8Array<ArrayBuffer> }[] = [];
  for (const file of entries) {
    if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(400, `${file.name} is over 10MB.`);
    if (!IMAGE_MIME.has(file.type)) throw new HttpError(400, "Use a JPEG, PNG, WEBP or GIF for inspo pictures.");
    const data = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;
    files.push({
      fileName: (file.name || "inspo").slice(0, 180),
      mimeType: file.type,
      sizeBytes: data.byteLength,
      data,
    });
  }
  return files;
}

function serializeNote(note: NoteRow): NoteDTO {
  return {
    id: note.id,
    title: note.title,
    description: note.description,
    links: note.links,
    platform: note.platform,
    date: note.date ? dayString(note.date) : null,
    doThisWeek: note.doThisWeek,
    status: note.status,
    checked: note.checked,
    authorName: note.author.name,
    postId: note.postId,
    images: note.images,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export async function listNotes(): Promise<NoteDTO[]> {
  const notes = await prisma.note.findMany({
    select: noteSelect,
    orderBy: [{ doThisWeek: "desc" }, { updatedAt: "desc" }],
  });
  return notes.map(serializeNote);
}

export async function createNote(user: UserDTO, form: FormData) {
  const input = readNoteInput(form);
  const images = await readImages(form);
  const note = await prisma.note.create({
    data: {
      title: input.title,
      description: input.description,
      links: input.links,
      platform: input.platform,
      date: input.date,
      doThisWeek: input.doThisWeek,
      status: input.checked ? "DONE" : input.status,
      checked: input.checked,
      authorId: user.id,
      images: { create: images },
    },
    select: noteSelect,
  });
  return serializeNote(note);
}

export async function updateNote(id: string, form: FormData) {
  const existing = await prisma.note.findUnique({
    where: { id },
    include: { images: { select: { id: true } } },
  });
  if (!existing) throw new HttpError(404, "That note has gone.");
  const input = readNoteInput(form);
  const images = await readImages(form);
  const removeIds = input.removeImageIds.filter((imageId) => existing.images.some((image) => image.id === imageId));
  if (existing.images.length - removeIds.length + images.length > MAX_IMAGES) {
    throw new HttpError(400, `You can add up to ${MAX_IMAGES} pictures.`);
  }
  const note = await prisma.$transaction(async (tx) => {
    if (removeIds.length > 0) {
      await tx.noteImage.deleteMany({ where: { noteId: id, id: { in: removeIds } } });
    }
    return tx.note.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        links: input.links,
        platform: input.platform,
        date: input.date,
        doThisWeek: input.doThisWeek,
        status: input.checked ? "DONE" : input.status === "DONE" ? "IDEA" : input.status,
        checked: input.checked,
        images: { create: images },
      },
      select: noteSelect,
    });
  });
  return serializeNote(note);
}

export async function patchNote(
  id: string,
  body: { checked?: boolean; date?: string | null; title?: string } | null,
) {
  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "That note has gone.");
  if (!body || typeof body !== "object") throw new HttpError(400, "Couldn't update that note.");
  const data: {
    checked?: boolean;
    status?: NoteStatus;
    date?: Date | null;
    title?: string;
  } = {};
  if (typeof body.checked === "boolean") {
    data.checked = body.checked;
    if (body.checked) data.status = "DONE";
    else if (existing.status === "DONE") data.status = "IDEA";
  }
  if (body.date !== undefined) {
    data.date = body.date ? parseOptionalDay(body.date) : null;
  }
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title || title.length > 140) throw new HttpError(400, "Enter a title, up to 140 characters.");
    data.title = title;
  }
  if (Object.keys(data).length === 0) throw new HttpError(400, "Nothing to update.");
  const note = await prisma.note.update({ where: { id }, data, select: noteSelect });
  return serializeNote(note);
}

export async function deleteNote(id: string) {
  const existing = await prisma.note.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, "That note has gone.");
  await prisma.note.delete({ where: { id } });
}

export async function getNoteImage(id: string) {
  return prisma.noteImage.findUnique({
    where: { id },
    select: { data: true, mimeType: true, fileName: true },
  });
}
