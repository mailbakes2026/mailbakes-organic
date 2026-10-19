import { Prisma } from "@prisma/client";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/service";
import type { IgProfileDTO } from "@/lib/types";

type Db = Prisma.TransactionClient;

export const IG_PROFILE_ID = "mailbakes";

export const DEFAULT_IG_BIO = [
  "🌸 daily softness, small joys & words that help you breathe",
  "🍰 cake-cards delivered UK-wide",
  "💌 spread a little sweetness today",
].join("\n");

export const DEFAULT_IG_HIGHLIGHTS = [
  "cakes",
  "our moments",
  "how to order",
  "reviews",
  "FAQs",
  "BTS",
];

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const profileInclude = {
  highlights: { orderBy: { position: "asc" as const } },
} satisfies Prisma.IgProfileInclude;

type ProfileRow = Prisma.IgProfileGetPayload<{ include: typeof profileInclude }>;

function serialize(row: ProfileRow): IgProfileDTO {
  return {
    handle: row.handle,
    displayName: row.displayName,
    bio: row.bio,
    link: row.link,
    postsCount: row.postsCount,
    followersCount: row.followersCount,
    followingCount: row.followingCount,
    avatarId: row.avatarId,
    highlights: row.highlights.map((item) => ({
      id: item.id,
      title: item.title,
      coverId: item.coverId,
    })),
  };
}

// Inserts the live MailBakes profile the first time only. An empty update
// means a later edit, including a cleared highlight row, is never overwritten.
export async function ensureIgProfile(db: Db) {
  await db.igProfile.upsert({
    where: { id: IG_PROFILE_ID },
    update: {},
    create: {
      id: IG_PROFILE_ID,
      handle: "mailbakesuk",
      displayName: "MailBakes",
      bio: DEFAULT_IG_BIO,
      link: "mailbakes.com",
      postsCount: 1390,
      followersCount: 130000,
      followingCount: 433,
      highlights: {
        create: DEFAULT_IG_HIGHLIGHTS.map((title, position) => ({ title, position })),
      },
    },
  });
}

async function loadProfile() {
  return prisma.igProfile.findUnique({
    where: { id: IG_PROFILE_ID },
    include: profileInclude,
  });
}

export async function getIgProfile(): Promise<IgProfileDTO> {
  let row = await loadProfile();
  if (!row) {
    await prisma.$transaction((db) => ensureIgProfile(db));
    row = await loadProfile();
  }
  if (!row) throw new HttpError(500, "The Instagram profile is not ready yet.");
  return serialize(row);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n") : "";
}

function readCount(value: unknown, label: string) {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const parsed = Number(raw.replace(/,/g, "").trim());
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2_000_000_000) {
    throw new HttpError(400, `Enter a whole number for ${label}.`);
  }
  return parsed;
}

type HighlightInput = { id: string | null; title: string };

function readHighlights(value: unknown): HighlightInput[] {
  if (!Array.isArray(value)) throw new HttpError(400, "Add the highlights as a list.");
  if (value.length > 20) throw new HttpError(400, "Keep it to 20 highlights.");
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new HttpError(400, "Check the highlights and try again.");
    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title || title.length > 40) {
      throw new HttpError(400, "Each highlight needs a name, up to 40 characters.");
    }
    const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
    if (id) {
      if (seen.has(id)) throw new HttpError(400, "Each highlight can only be listed once.");
      seen.add(id);
    }
    return { id, title };
  });
}

export async function updateIgProfile(input: unknown): Promise<IgProfileDTO> {
  if (!input || typeof input !== "object") throw new HttpError(400, "Couldn't read that profile.");
  const body = input as Record<string, unknown>;
  const handle = cleanText(body.handle).trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
    throw new HttpError(400, "Use a handle made of letters, numbers, dots or underscores.");
  }
  const displayName = cleanText(body.displayName).trim();
  if (!displayName || displayName.length > 80) {
    throw new HttpError(400, "Enter a display name, up to 80 characters.");
  }
  const bio = cleanText(body.bio).replace(/^\s+|\s+$/g, "");
  if (bio.length > 1000) throw new HttpError(400, "Keep the bio under 1,000 characters.");
  const link = cleanText(body.link).trim();
  if (link.length > 200) throw new HttpError(400, "Keep the link under 200 characters.");
  const postsCount = readCount(body.postsCount, "posts");
  const followersCount = readCount(body.followersCount, "followers");
  const followingCount = readCount(body.followingCount, "following");
  const highlights = readHighlights(body.highlights);

  await prisma.$transaction(async (db) => {
    await ensureIgProfile(db);
    const existing = await db.igHighlight.findMany({ where: { profileId: IG_PROFILE_ID } });
    const keep = new Set(highlights.flatMap((item) => (item.id ? [item.id] : [])));
    const removed = existing.filter((item) => !keep.has(item.id));
    if (removed.length > 0) {
      await db.igHighlight.deleteMany({ where: { id: { in: removed.map((item) => item.id) } } });
      const coverIds = removed.flatMap((item) => (item.coverId ? [item.coverId] : []));
      if (coverIds.length > 0) await db.igMedia.deleteMany({ where: { id: { in: coverIds } } });
    }
    for (const [position, item] of highlights.entries()) {
      if (item.id) {
        const found = existing.find((row) => row.id === item.id);
        if (!found) throw new HttpError(400, "One of those highlights has gone. Reload and try again.");
        await db.igHighlight.update({
          where: { id: item.id },
          data: { title: item.title, position },
        });
      } else {
        await db.igHighlight.create({
          data: { profileId: IG_PROFILE_ID, title: item.title, position },
        });
      }
    }
    await db.igProfile.update({
      where: { id: IG_PROFILE_ID },
      data: { handle, displayName, bio, link, postsCount, followersCount, followingCount },
    });
  });

  return getIgProfile();
}

async function readProfileImage(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new HttpError(400, "Choose an image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, `${file.name} is over 10MB.`);
  }
  if (!IMAGE_MIME.has(file.type)) {
    throw new HttpError(400, "Use a JPEG, PNG, WEBP or GIF, up to 10MB.");
  }
  const data = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;
  return {
    fileName: (file.name || "upload").slice(0, 180),
    mimeType: file.type,
    sizeBytes: data.byteLength,
    data,
  };
}

export async function setIgAvatar(form: FormData) {
  const image = await readProfileImage(form);
  await prisma.$transaction(async (db) => {
    await ensureIgProfile(db);
    const profile = await db.igProfile.findUnique({ where: { id: IG_PROFILE_ID } });
    const created = await db.igMedia.create({ data: image });
    await db.igProfile.update({ where: { id: IG_PROFILE_ID }, data: { avatarId: created.id } });
    if (profile?.avatarId) await db.igMedia.delete({ where: { id: profile.avatarId } });
  });
  return getIgProfile();
}

export async function clearIgAvatar() {
  const profile = await prisma.igProfile.findUnique({ where: { id: IG_PROFILE_ID } });
  if (profile?.avatarId) {
    const avatarId = profile.avatarId;
    await prisma.$transaction([
      prisma.igProfile.update({ where: { id: IG_PROFILE_ID }, data: { avatarId: null } }),
      prisma.igMedia.delete({ where: { id: avatarId } }),
    ]);
  }
  return getIgProfile();
}

async function requireHighlight(id: string) {
  const highlight = await prisma.igHighlight.findFirst({ where: { id, profileId: IG_PROFILE_ID } });
  if (!highlight) throw new HttpError(404, "That highlight has gone.");
  return highlight;
}

export async function setHighlightCover(id: string, form: FormData) {
  const image = await readProfileImage(form);
  const highlight = await requireHighlight(id);
  await prisma.$transaction(async (db) => {
    const created = await db.igMedia.create({ data: image });
    await db.igHighlight.update({ where: { id: highlight.id }, data: { coverId: created.id } });
    if (highlight.coverId) await db.igMedia.delete({ where: { id: highlight.coverId } });
  });
  return getIgProfile();
}

export async function clearHighlightCover(id: string) {
  const highlight = await requireHighlight(id);
  if (highlight.coverId) {
    const coverId = highlight.coverId;
    await prisma.$transaction([
      prisma.igHighlight.update({ where: { id: highlight.id }, data: { coverId: null } }),
      prisma.igMedia.delete({ where: { id: coverId } }),
    ]);
  }
  return getIgProfile();
}

export async function getIgMedia(id: string) {
  return prisma.igMedia.findUnique({
    where: { id },
    select: { data: true, mimeType: true, fileName: true },
  });
}
