import { Prisma } from "@prisma/client";
import type { CommentKind, ContentType, KeyDateKind, Platform, PostStatus, Role } from "@prisma/client";
import { ALLOWED_MIME, MAX_FILES, MAX_UPLOAD_BYTES, STORY_PLATFORMS } from "@/lib/constants";
import { postsAdded, readyForApproval } from "@/lib/notify-personal";
import { approverMayAct, statusAfterSave } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";
import type { ContentTypeId, KeyDateDTO, PlatformId, PostDTO, StatusId, UserDTO } from "@/lib/types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PLATFORMS: PlatformId[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "LINKEDIN",
  "YOUTUBE_SHORTS",
  "SNAPCHAT",
  "PINTEREST",
];
const TYPES: ContentTypeId[] = ["FEED", "REEL", "STORY"];
const STATUSES: StatusId[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "CHANGES_REQUESTED",
  "AMENDMENTS_MADE",
  "APPROVED",
  "REJECTED",
];

const postSelect = {
  id: true,
  title: true,
  platforms: true,
  contentType: true,
  plannedDate: true,
  plannedTime: true,
  status: true,
  caption: true,
  creativeNotes: true,
  authorId: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { name: true } },
  reviewer: { select: { name: true } },
  media: {
    select: { id: true, role: true, fileName: true, mimeType: true, sizeBytes: true, position: true },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
  },
  comments: {
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      authorName: true,
      author: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  stats: {
    select: {
      platform: true,
      views: true,
      likes: true,
      comments: true,
      shares: true,
      saves: true,
      linkClicks: true,
      source: true,
      syncedAt: true,
    },
    orderBy: { platform: "asc" as const },
  },
} satisfies Prisma.PostSelect;

type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, "Choose a valid date.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, "Choose a valid date.");
  }
  return date;
}

function serializePost(post: PostRow): PostDTO {
  return {
    id: post.id,
    title: post.title,
    platforms: post.platforms,
    contentType: post.contentType,
    plannedDate: dayString(post.plannedDate),
    plannedTime: post.plannedTime,
    status: post.status,
    caption: post.caption,
    creativeNotes: post.creativeNotes,
    authorId: post.authorId,
    authorName: post.author.name,
    reviewerName: post.reviewer?.name ?? null,
    reviewedAt: post.reviewedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    media: post.media.filter((item) => item.role !== "REEL_COVER").map(toMedia),
    reelCover: (() => {
      const cover = post.media.find((item) => item.role === "REEL_COVER");
      return cover ? toMedia(cover) : null;
    })(),
    stats: post.stats.map((stat) => ({
      platform: stat.platform,
      views: stat.views,
      likes: stat.likes,
      comments: stat.comments,
      shares: stat.shares,
      saves: stat.saves,
      linkClicks: stat.linkClicks,
      source: stat.source,
      syncedAt: stat.syncedAt?.toISOString() ?? null,
    })),
    comments: post.comments.map((comment) => ({
      id: comment.id,
      kind: comment.kind,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      authorName: comment.authorName || comment.author.name,
    })),
  };
}

function toMedia(item: { id: string; fileName: string; mimeType: string; sizeBytes: number }) {
  return {
    id: item.id,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
  };
}

function parseTime(value: string) {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
  if (!match) throw new HttpError(400, "Choose a posting time, like 12:00.");
  return `${match[1]}:${match[2]}`;
}

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

type PostInput = {
  title: string;
  platforms: Platform[];
  contentType: ContentType;
  plannedDate: string;
  plannedTime: string | null;
  status: PostStatus;
  caption: string;
  creativeNotes: string;
  removeMediaIds: string[];
};

function readPostInput(form: FormData): PostInput {
  const title = field(form, "title");
  if (!title || title.length > 140) {
    throw new HttpError(400, "Enter a title, up to 140 characters.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(field(form, "platforms") || "[]");
  } catch {
    throw new HttpError(400, "Choose at least one platform.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new HttpError(400, "Choose at least one platform.");
  }
  const platforms = [...new Set(parsed.map(String))];
  if (platforms.some((item) => !PLATFORMS.includes(item as PlatformId))) {
    throw new HttpError(400, "Choose a valid platform.");
  }
  const contentType = field(form, "contentType");
  if (!TYPES.includes(contentType as ContentTypeId)) {
    throw new HttpError(400, "Choose a content type.");
  }
  const status = field(form, "status");
  if (!STATUSES.includes(status as StatusId)) {
    throw new HttpError(400, "Choose a status.");
  }
  const caption = field(form, "caption");
  if (!caption || caption.length > 5000) {
    throw new HttpError(400, "Enter the caption.");
  }
  const creativeNotes = field(form, "creativeNotes");
  if (creativeNotes.length > 5000) {
    throw new HttpError(400, "Keep the notes under 5,000 characters.");
  }
  if (contentType === "STORY") {
    const invalid = platforms.filter(
      (item) => !STORY_PLATFORMS.includes(item as PlatformId),
    );
    if (invalid.length > 0) {
      throw new HttpError(
        400,
        "Stories can be planned for Instagram, Facebook and Snapchat. Use a Reel or short video for the other platforms.",
      );
    }
  }
  let removeMediaIds: string[] = [];
  const removeRaw = field(form, "removeMediaIds");
  if (removeRaw) {
    try {
      const value = JSON.parse(removeRaw);
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        throw new Error("bad");
      }
      removeMediaIds = value;
    } catch {
      throw new HttpError(400, "Couldn't update the attachments.");
    }
  }
  return {
    title,
    platforms: platforms as Platform[],
    contentType: contentType as ContentType,
    plannedDate: field(form, "plannedDate"),
    plannedTime: parseTime(field(form, "plannedTime")),
    status: status as PostStatus,
    caption,
    creativeNotes,
    removeMediaIds,
  };
}

async function readFiles(form: FormData) {
  const entries = form
    .getAll("media")
    .filter((item): item is File => item instanceof File && item.size > 0);
  if (entries.length > MAX_FILES) {
    throw new HttpError(400, `You can attach up to ${MAX_FILES} files.`);
  }
  const files: { fileName: string; mimeType: string; sizeBytes: number; data: Uint8Array<ArrayBuffer> }[] = [];
  for (const file of entries) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(
        400,
        `${file.name} is over 10MB. For a longer video, put a link in the notes.`,
      );
    }
    if (!ALLOWED_MIME.has(file.type)) {
      throw new HttpError(
        400,
        "Use a JPEG, PNG, WEBP, GIF, MP4, WEBM or MOV, up to 10MB each.",
      );
    }
    const data = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;
    files.push({
      fileName: (file.name || "upload").slice(0, 180),
      mimeType: file.type,
      sizeBytes: data.byteLength,
      data,
    });
  }
  return files;
}

const COVER_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function readCover(form: FormData) {
  const file = form.get("reelCover");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, `${file.name} is over 10MB.`);
  }
  if (!COVER_MIME.has(file.type)) {
    throw new HttpError(400, "Use a JPEG, PNG, WEBP or GIF for the reel cover, up to 10MB.");
  }
  const data = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;
  return {
    fileName: (file.name || "reel-cover").slice(0, 180),
    mimeType: file.type,
    sizeBytes: data.byteLength,
    data,
    role: "REEL_COVER" as const,
  };
}

type StoredFile = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  data: Uint8Array<ArrayBuffer>;
};

function readMediaOrder(form: FormData): string[] | null {
  const raw = field(form, "mediaOrder");
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Couldn't update the order of the files.");
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !/^(?:id:.+|new:\d+)$/.test(item))) {
    throw new HttpError(400, "Couldn't update the order of the files.");
  }
  return value;
}

function orderNewFiles(files: StoredFile[], order: string[] | null) {
  if (!order) return files.map((file, position) => ({ ...file, position }));
  const placed: (StoredFile & { position: number })[] = [];
  const used = new Set<number>();
  let position = 0;
  for (const token of order) {
    if (!token.startsWith("new:")) continue;
    const index = Number(token.slice(4));
    if (!Number.isInteger(index) || index < 0 || index >= files.length || used.has(index)) continue;
    used.add(index);
    placed.push({ ...files[index], position: position++ });
  }
  files.forEach((file, index) => {
    if (!used.has(index)) placed.push({ ...file, position: position++ });
  });
  return placed;
}

function attachmentOrder(keptIds: string[], createdIds: string[], order: string[] | null) {
  if (!order) return [...keptIds, ...createdIds];
  const kept = new Set(keptIds);
  const ordered: string[] = [];
  for (const token of order) {
    if (token.startsWith("id:")) {
      const id = token.slice(3);
      if (kept.has(id) && !ordered.includes(id)) ordered.push(id);
    } else if (token.startsWith("new:")) {
      const created = createdIds[Number(token.slice(4))];
      if (created && !ordered.includes(created)) ordered.push(created);
    }
  }
  for (const id of [...keptIds, ...createdIds]) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

function savedStatus(role: Role, requested: PostStatus, previous?: PostStatus) {
  const status = statusAfterSave(role, requested, previous);
  if (!status) {
    throw new HttpError(403, "The team can save a draft or send it for approval.");
  }
  return status;
}

export async function listPosts(): Promise<PostDTO[]> {
  const posts = await prisma.post.findMany({
    select: postSelect,
    orderBy: [{ plannedDate: "asc" }, { plannedTime: "asc" }, { createdAt: "asc" }],
  });
  return posts.map(serializePost);
}

export async function listKeyDates(): Promise<KeyDateDTO[]> {
  const rows = await prisma.keyDate.findMany({ orderBy: { date: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    date: dayString(row.date),
    kind: row.kind,
    notes: row.notes,
  }));
}

export async function createPost(user: UserDTO, form: FormData) {
  const input = readPostInput(form);
  const status = savedStatus(user.role, input.status);
  const files = orderNewFiles(await readFiles(form), readMediaOrder(form));
  const cover = input.contentType === "REEL" ? await readCover(form) : null;
  const reviewed =
    user.role === "MANAGEMENT" &&
    (status === "APPROVED" || status === "REJECTED" || status === "CHANGES_REQUESTED");
  const post = await prisma.post.create({
    data: {
      title: input.title,
      platforms: input.platforms,
      contentType: input.contentType,
      plannedDate: parseDay(input.plannedDate),
      plannedTime: input.plannedTime,
      status,
      caption: input.caption,
      creativeNotes: input.creativeNotes,
      authorId: user.id,
      reviewerId: reviewed ? user.id : null,
      reviewedAt: reviewed ? new Date() : null,
      media: {
        create: [
          ...files.map((file) => ({
            role: "ATTACHMENT" as const,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            data: file.data,
            position: file.position,
          })),
          ...(cover ? [{ ...cover, position: 0 }] : []),
        ],
      },
    },
    select: postSelect,
  });
  await postsAdded(user);
  return serializePost(post);
}

export async function updatePost(user: UserDTO, id: string, form: FormData) {
  const existing = await prisma.post.findUnique({
    where: { id },
    include: { media: { select: { id: true, role: true, position: true } } },
  });
  if (!existing) throw new HttpError(404, "That post has gone.");
  const input = readPostInput(form);
  const status = savedStatus(user.role, input.status, existing.status);
  const files = await readFiles(form);
  const order = readMediaOrder(form);
  const attachments = existing.media
    .filter((media) => media.role !== "REEL_COVER")
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const currentCover = existing.media.find((media) => media.role === "REEL_COVER");
  const removeIds = input.removeMediaIds.filter((mediaId) =>
    attachments.some((media) => media.id === mediaId),
  );
  const remaining = attachments.length - removeIds.length;
  if (remaining + files.length > MAX_FILES) {
    throw new HttpError(400, `You can attach up to ${MAX_FILES} files.`);
  }
  const notes: string[] = [];
  if (existing.status === "APPROVED" && status === "AMENDMENTS_MADE") {
    notes.push("Edited after approval, so it's back for approval.");
  } else if (existing.status === "CHANGES_REQUESTED" && status === "AMENDMENTS_MADE") {
    notes.push("Amendments made.");
  } else if (existing.status === "CHANGES_REQUESTED" && status === "PENDING_APPROVAL") {
    notes.push("Sent back for approval.");
  }
  const reviewed =
    user.role === "MANAGEMENT" &&
    status !== existing.status &&
    (status === "APPROVED" || status === "REJECTED" || status === "CHANGES_REQUESTED");
  const cover = input.contentType === "REEL" ? await readCover(form) : null;
  const removeCover =
    Boolean(currentCover) && (input.contentType !== "REEL" || field(form, "removeReelCover") === "true" || Boolean(cover));

  const post = await prisma.$transaction(async (tx) => {
    const dropIds = [...removeIds, ...(removeCover && currentCover ? [currentCover.id] : [])];
    if (dropIds.length > 0) {
      await tx.media.deleteMany({ where: { postId: id, id: { in: dropIds } } });
    }
    const createdIds: string[] = [];
    for (const file of files) {
      const created = await tx.media.create({
        data: {
          postId: id,
          role: "ATTACHMENT",
          fileName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          data: file.data,
          position: 0,
        },
        select: { id: true },
      });
      createdIds.push(created.id);
    }
    if (cover) {
      await tx.media.create({
        data: { postId: id, ...cover, position: 0 },
      });
    }
    const keptIds = attachments.filter((media) => !removeIds.includes(media.id)).map((media) => media.id);
    const ordered = attachmentOrder(keptIds, createdIds, order);
    for (let position = 0; position < ordered.length; position += 1) {
      await tx.media.update({ where: { id: ordered[position] }, data: { position } });
    }
    return tx.post.update({
      where: { id },
      data: {
        title: input.title,
        platforms: input.platforms,
        contentType: input.contentType,
        plannedDate: parseDay(input.plannedDate),
        plannedTime: input.plannedTime,
        status,
        caption: input.caption,
        creativeNotes: input.creativeNotes,
        reviewerId: reviewed ? user.id : undefined,
        reviewedAt: reviewed ? new Date() : undefined,
        comments: notes.length
          ? {
              create: notes.map((body) => ({
                authorId: user.id,
                authorName: user.name,
                kind: "NOTE" as CommentKind,
                body,
              })),
            }
          : undefined,
      },
      select: postSelect,
    });
  });
  if (status === "PENDING_APPROVAL" && existing.status !== "PENDING_APPROVAL") {
    await readyForApproval(user, { id, title: input.title }, "resubmitted");
  }
  return serializePost(post);
}

export async function reschedulePost(user: UserDTO, id: string, plannedDate: string) {
  const existing = await prisma.post.findUnique({ where: { id }, select: { plannedDate: true } });
  if (!existing) throw new HttpError(404, "That post has gone.");
  const date = parseDay(plannedDate);
  const from = dayString(existing.plannedDate);
  if (from === plannedDate) {
    const current = await prisma.post.findUnique({ where: { id }, select: postSelect });
    if (!current) throw new HttpError(404, "That post has gone.");
    return serializePost(current);
  }
  const post = await prisma.post.update({
    where: { id },
    data: {
      plannedDate: date,
      comments: {
        create: {
          authorId: user.id,
          authorName: user.name,
          kind: "NOTE",
          body: `Moved from ${from} to ${plannedDate}.`,
        },
      },
    },
    select: postSelect,
  });
  return serializePost(post);
}

const METRIC_KEYS = ["views", "likes", "comments", "shares", "saves", "linkClicks"] as const;

function parseMetric(value: unknown, label: string) {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < 0 || number > 2_000_000_000) {
    throw new HttpError(400, `${label} needs a whole number, or leave it blank.`);
  }
  return number;
}

export async function updatePostStats(id: string, body: unknown) {
  const post = await prisma.post.findUnique({ where: { id }, select: { platforms: true } });
  if (!post) throw new HttpError(404, "That post has gone.");
  if (!body || typeof body !== "object" || !Array.isArray((body as { stats?: unknown }).stats)) {
    throw new HttpError(400, "Couldn't read those stats.");
  }
  const rows = (body as { stats: unknown[] }).stats;
  const seen = new Set<string>();
  const parsed: {
    platform: Platform;
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    linkClicks: number | null;
  }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") throw new HttpError(400, "Couldn't read those stats.");
    const record = row as Record<string, unknown>;
    const platform = String(record.platform ?? "");
    if (!post.platforms.includes(platform as Platform)) {
      throw new HttpError(400, "Stats can only be saved for a platform on this post.");
    }
    if (seen.has(platform)) throw new HttpError(400, "Each platform only needs one set of stats.");
    seen.add(platform);
    const metrics = {
      views: parseMetric(record.views, "Views"),
      likes: parseMetric(record.likes, "Likes"),
      comments: parseMetric(record.comments, "Comments"),
      shares: parseMetric(record.shares, "Shares"),
      saves: parseMetric(record.saves, "Saves"),
      linkClicks: parseMetric(record.linkClicks, "Link clicks"),
    };
    if (METRIC_KEYS.some((key) => metrics[key] != null)) {
      parsed.push({ platform: platform as Platform, ...metrics });
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.postStat.deleteMany({
      where:
        parsed.length === 0
          ? { postId: id }
          : { postId: id, platform: { notIn: parsed.map((item) => item.platform) } },
    });
    for (const item of parsed) {
      await tx.postStat.upsert({
        where: { postId_platform: { postId: id, platform: item.platform } },
        create: { postId: id, ...item, source: "MANUAL", syncedAt: null },
        update: { ...item, source: "MANUAL", syncedAt: null },
      });
    }
  });
  const updated = await prisma.post.findUnique({ where: { id }, select: postSelect });
  if (!updated) throw new HttpError(404, "That post has gone.");
  return serializePost(updated);
}

export async function turnNoteIntoPost(user: UserDTO, noteId: string) {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: { images: { orderBy: { createdAt: "asc" } } },
  });
  if (!note) throw new HttpError(404, "That note has gone.");
  if (note.postId) {
    const existing = await prisma.post.findUnique({ where: { id: note.postId }, select: postSelect });
    if (existing) return serializePost(existing);
  }
  const caption = note.description.trim() || note.title;
  const inspo = note.links.length > 0 ? `Inspo:\n${note.links.join("\n")}` : "";
  const plannedDate = note.date ?? parseDay(londonToday());
  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        title: note.title.slice(0, 140),
        platforms: note.allPlatforms ? [...PLATFORMS] as Platform[] : [note.platform ?? "INSTAGRAM"],
        contentType: "FEED",
        plannedDate,
        plannedTime: "12:00",
        status: "DRAFT",
        caption: caption.slice(0, 5000),
        creativeNotes: inspo.slice(0, 5000),
        authorId: user.id,
        media: {
          create: note.images.map((image, position) => ({
            role: "ATTACHMENT" as const,
            fileName: image.fileName,
            mimeType: image.mimeType,
            sizeBytes: image.sizeBytes,
            data: new Uint8Array(image.data) as Uint8Array<ArrayBuffer>,
            position,
          })),
        },
      },
      select: postSelect,
    });
    await tx.note.update({
      where: { id: note.id },
      data: {
        postId: created.id,
        status: note.status === "DONE" ? "DONE" : "PLANNED",
      },
    });
    return created;
  });
  return serializePost(post);
}

function londonToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function deletePost(user: UserDTO, id: string) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new HttpError(404, "That post has gone.");
  if (user.role !== "MANAGEMENT" && (post.authorId !== user.id || post.status !== "DRAFT")) {
    throw new HttpError(403, "You can only delete your own drafts.");
  }
  await prisma.post.delete({ where: { id } });
}

export async function markAmendments(user: UserDTO, id: string) {
  if (user.role !== "TEAM") {
    throw new HttpError(403, "The manager sends amendments back for approval.");
  }
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new HttpError(404, "That post has gone.");
  if (post.status !== "CHANGES_REQUESTED") {
    const current = await prisma.post.findUnique({ where: { id }, select: postSelect });
    if (!current) throw new HttpError(404, "That post has gone.");
    return serializePost(current);
  }
  const updated = await prisma.post.update({
    where: { id },
    data: {
      status: "AMENDMENTS_MADE",
      comments: {
        create: {
          authorId: user.id,
          authorName: user.name,
          kind: "NOTE",
          body: "Amendments made.",
        },
      },
    },
    select: postSelect,
  });
  await readyForApproval(user, { id, title: post.title }, "amended");
  return serializePost(updated);
}

export async function restoreToApproval(user: UserDTO, id: string) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new HttpError(404, "That post has gone.");
  if (post.status !== "REJECTED") throw new HttpError(400, "This post isn't declined.");
  const updated = await prisma.post.update({
    where: { id },
    data: {
      status: "PENDING_APPROVAL",
      comments: {
        create: {
          authorId: user.id,
          authorName: user.name,
          kind: "NOTE",
          body: "Moved back to approval.",
        },
      },
    },
    select: postSelect,
  });
  return serializePost(updated);
}

export async function reviewPost(user: UserDTO, id: string, action: string, comment: string) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new HttpError(404, "That post has gone.");
  if (action !== "approve" && action !== "reject" && action !== "request_changes") {
    throw new HttpError(400, "Unknown action.");
  }
  if (!approverMayAct(user.role, post.status, action)) {
    if (user.role !== "MANAGEMENT") {
      throw new HttpError(403, "Only Millie can approve.");
    }
    throw new HttpError(400, "This post isn't waiting for approval.");
  }
  const text = comment.trim();
  let status: PostStatus;
  let kind: CommentKind;
  if (action === "approve") {
    status = "APPROVED";
    kind = "APPROVAL";
  } else if (action === "reject") {
    status = "REJECTED";
    kind = "REJECTION";
  } else {
    if (!text) throw new HttpError(400, "Add a comment so the manager knows what to change.");
    status = "CHANGES_REQUESTED";
    kind = "CHANGES";
  }
  const updated = await prisma.post.update({
    where: { id },
    data: {
      status,
      reviewerId: user.id,
      reviewedAt: new Date(),
      comments: {
        create: {
          authorId: user.id,
          authorName: user.name,
          kind,
          body: text || (action === "reject" ? "Declined." : "Approved."),
        },
      },
    },
    select: postSelect,
  });
  return serializePost(updated);
}

function readKeyDate(form: FormData) {
  const title = field(form, "title");
  if (!title || title.length > 140) throw new HttpError(400, "Enter a title.");
  const kind = field(form, "kind");
  if (kind !== "LAUNCH" && kind !== "KEY_DATE") {
    throw new HttpError(400, "Choose launch or key date.");
  }
  const notes = field(form, "notes");
  if (notes.length > 2000) throw new HttpError(400, "Keep the notes shorter.");
  return {
    title,
    date: parseDay(field(form, "date")),
    kind: kind as KeyDateKind,
    notes,
  };
}

export async function createKeyDate(user: UserDTO, form: FormData) {
  const input = readKeyDate(form);
  const row = await prisma.keyDate.create({
    data: { ...input, authorId: user.id },
  });
  return {
    id: row.id,
    title: row.title,
    date: dayString(row.date),
    kind: row.kind,
    notes: row.notes,
  } satisfies KeyDateDTO;
}

export async function deleteKeyDate(id: string) {
  const row = await prisma.keyDate.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, "That date has gone.");
  await prisma.keyDate.delete({ where: { id } });
}

export async function getMedia(id: string) {
  return prisma.media.findUnique({
    where: { id },
    select: { data: true, mimeType: true, fileName: true },
  });
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
