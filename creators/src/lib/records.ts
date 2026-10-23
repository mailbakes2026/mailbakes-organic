import { Prisma, Stage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sortCreators } from "@/lib/order";
import type { CreatorPatch, InquiryInput } from "@/lib/parse";
import { SEEDED_AT, SHEET_ACTIVITY, buildSeed } from "@/lib/seed-build";
import { STAGES, type StageSlug } from "@/lib/stages";
import {
  interpretTiktokOrders,
  linesAfterSend,
  matchSummary,
  planOrderMatches,
  shouldPushSavedMessage,
  type MatchLine,
  type ReviewItem,
  type UnclaimedOrder,
} from "@/lib/match-orders";
import { opsGet, postTiktokMessage, readTiktokMessage, readTiktokOrderId, shouldSendTiktokMessage, type OpsResult, type OpsStatus } from "@/lib/ops";
import { royalMailTrackUrl, safeHttpUrl } from "@/lib/tracking";
import type { ActivityDTO, CreatorDetail, CreatorDTO, CreatorFields } from "@/lib/types";
import { applyUpdate } from "@/lib/update";

const SEED_ID = "tiktok-sample-sheet";

function prismaStage(slug: StageSlug): Stage {
  switch (slug) {
    case "inquiry":
      return Stage.INQUIRY;
    case "approved":
      return Stage.APPROVED;
    case "message_needed":
      return Stage.MESSAGE_NEEDED;
    case "ready_to_ship":
      return Stage.READY_TO_SHIP;
    case "shipped":
      return Stage.SHIPPED;
    case "delivered":
      return Stage.DELIVERED;
    case "posted":
      return Stage.POSTED;
    case "declined":
      return Stage.DECLINED;
    case "on_hold":
      return Stage.ON_HOLD;
  }
}

function slugOf(stage: Stage): StageSlug {
  const found = STAGES.find((item) => item.prisma === stage);
  if (!found) throw new Error(`Unknown stage ${stage}`);
  return found.slug;
}

function dayString(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

type CreatorRow = {
  id: string;
  name: string;
  handle: string;
  email: string;
  shopifyOrder: string;
  stage: Stage;
  rush: boolean;
  cardMessage: string;
  notes: string;
  shipDate: Date | null;
  courier: string;
  trackingNumber: string;
  declineReason: string;
  posted: boolean;
  postUrl: string;
  views: number | null;
  orders: number | null;
  rating: number | null;
  worksWell: boolean;
  tiktokOrderId: string;
  tiktokMessage: string;
  opsStatus: string;
  opsError: string;
  opsSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function fieldsOf(row: CreatorRow): CreatorFields {
  return {
    name: row.name,
    handle: row.handle,
    email: row.email,
    shopifyOrder: row.shopifyOrder,
    stage: slugOf(row.stage),
    rush: row.rush,
    cardMessage: row.cardMessage,
    notes: row.notes,
    shipDate: dayString(row.shipDate),
    courier: row.courier,
    trackingNumber: row.trackingNumber,
    declineReason: row.declineReason,
    posted: row.posted,
    postUrl: row.postUrl,
    views: row.views,
    orders: row.orders,
    rating: row.rating,
    worksWell: row.worksWell,
    tiktokOrderId: row.tiktokOrderId,
    tiktokMessage: row.tiktokMessage,
  };
}

function opsStatusOf(value: string): OpsStatus {
  if (value === "sent" || value === "failed" || value === "not_configured") return value;
  return "";
}

export function toDTO(row: CreatorRow): CreatorDTO {
  const fields = fieldsOf(row);
  return {
    ...fields,
    id: row.id,
    trackingUrl: royalMailTrackUrl(fields.trackingNumber, fields.courier),
    postHref: safeHttpUrl(fields.postUrl),
    opsStatus: opsStatusOf(row.opsStatus),
    opsError: row.opsError,
    opsSentAt: row.opsSentAt ? row.opsSentAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toActivity(row: { id: string; detail: string; createdAt: Date }): ActivityDTO {
  return { id: row.id, detail: row.detail, createdAt: row.createdAt.toISOString() };
}

const detailInclude = {
  activities: { orderBy: { createdAt: "desc" as const } },
};

export async function ensureSeeded() {
  const existing = await prisma.appMeta.findUnique({ where: { id: SEED_ID } });
  if (existing) return;
  const creators = buildSeed();
  const when = new Date(SEEDED_AT);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.appMeta.create({ data: { id: SEED_ID, createdAt: when } });
      for (const creator of creators) {
        await tx.creator.create({
          data: {
            id: creator.id,
            name: creator.name,
            handle: creator.handle,
            email: creator.email,
            shopifyOrder: creator.shopifyOrder,
            stage: prismaStage(creator.stage),
            rush: creator.rush,
            cardMessage: creator.cardMessage,
            notes: creator.notes,
            source: "sheet",
            createdAt: when,
            updatedAt: when,
            activities: {
              create: {
                id: `activity-${creator.id}`,
                detail: SHEET_ACTIVITY,
                createdAt: when,
              },
            },
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}

export async function listCreators() {
  const rows = await prisma.creator.findMany();
  return sortCreators(rows.map(toDTO));
}

export async function getCreator(id: string): Promise<CreatorDetail | null> {
  const row = await prisma.creator.findUnique({ where: { id }, include: detailInclude });
  if (!row) return null;
  return { ...toDTO(row), activities: row.activities.map(toActivity) };
}

export async function createInquiry(input: InquiryInput, source: "manual" | "api") {
  const detail = source === "api" ? "Inquiry added from the API." : "Inquiry added by hand.";
  const row = await prisma.creator.create({
    data: {
      name: input.name,
      handle: input.handle,
      email: input.email,
      shopifyOrder: input.shopifyOrder,
      cardMessage: input.cardMessage,
      notes: input.notes,
      rush: input.rush,
      stage: Stage.INQUIRY,
      source,
      activities: { create: { detail } },
    },
    include: detailInclude,
  });
  return { ...toDTO(row), activities: row.activities.map(toActivity) };
}

export async function updateCreator(id: string, patch: CreatorPatch, now = new Date()) {
  const current = await prisma.creator.findUnique({ where: { id } });
  if (!current) return { ok: false as const, status: 404, error: "That creator isn't on the board." };
  const applied = applyUpdate(fieldsOf(current), patch, now);
  if (!applied.ok) return { ok: false as const, status: 400, error: applied.error };
  const next = applied.next;
  const explicit = patch.sendToOrders === true;
  const sending = shouldSendTiktokMessage({
    tiktokOrderId: next.tiktokOrderId,
    tiktokMessage: next.tiktokMessage,
    previousId: current.tiktokOrderId,
    previousMessage: current.tiktokMessage,
    opsStatus: current.opsStatus,
    explicit,
  });
  if (explicit) {
    if (!next.tiktokOrderId) return { ok: false as const, status: 400, error: "Enter the TikTok order ID." };
    if (!next.tiktokMessage.trim()) return { ok: false as const, status: 400, error: "Enter a message for the order." };
  }

  const messageChanged = current.tiktokOrderId !== next.tiktokOrderId || current.tiktokMessage !== next.tiktokMessage;
  if (applied.detail !== "Saved.") {
    await prisma.creator.update({
      where: { id },
      data: {
        name: next.name,
        handle: next.handle,
        email: next.email,
        shopifyOrder: next.shopifyOrder,
        stage: prismaStage(next.stage),
        rush: next.rush,
        cardMessage: next.cardMessage,
        notes: next.notes,
        shipDate: next.shipDate ? new Date(`${next.shipDate}T00:00:00.000Z`) : null,
        courier: next.courier,
        trackingNumber: next.trackingNumber,
        declineReason: next.declineReason,
        posted: next.posted,
        postUrl: next.postUrl,
        views: next.views,
        orders: next.orders,
        rating: next.rating,
        worksWell: next.worksWell,
        tiktokOrderId: next.tiktokOrderId,
        tiktokMessage: next.tiktokMessage,
        ...(messageChanged && !sending ? { opsStatus: "", opsError: "", opsSentAt: null } : {}),
        updatedAt: now,
        activities: { create: { detail: applied.detail } },
      },
    });
  }

  if (sending) {
    const result = await postTiktokMessage(next.tiktokOrderId, next.tiktokMessage);
    await storeTiktokSend(id, next.tiktokOrderId, next.tiktokMessage, result, now);
  }

  const creator = await getCreator(id);
  if (!creator) return { ok: false as const, status: 404, error: "That creator isn't on the board." };
  return { ok: true as const, creator };
}

function sendDetail(result: OpsResult) {
  if (result.status === "sent") return "Sent the TikTok order message.";
  if (result.status === "not_configured") return "TikTok order message was not sent. The orders app is not configured.";
  return `The TikTok order message failed: ${result.error}`;
}

async function storeTiktokSend(id: string, tiktokOrderId: string, tiktokMessage: string, result: OpsResult, now: Date) {
  await prisma.creator.update({
    where: { id },
    data: {
      tiktokOrderId,
      tiktokMessage,
      opsStatus: result.status,
      opsError: result.error,
      opsSentAt: result.status === "sent" ? now : null,
      updatedAt: now,
      activities: { create: { detail: sendDetail(result) } },
    },
  });
}

export async function syncUnsentTiktokMessages(now = new Date()) {
  const rows = await prisma.creator.findMany({
    where: { NOT: { opsStatus: "sent" } },
    orderBy: { name: "asc" },
  });
  const waiting = rows.filter((row) => row.tiktokOrderId.trim() !== "" && row.tiktokMessage.trim() !== "");
  const results: { id: string; name: string; tiktokOrderId: string; status: OpsStatus; error: string }[] = [];
  for (const row of waiting) {
    const result = await postTiktokMessage(row.tiktokOrderId, row.tiktokMessage);
    await storeTiktokSend(row.id, row.tiktokOrderId, row.tiktokMessage, result, now);
    results.push({
      id: row.id,
      name: row.name,
      tiktokOrderId: row.tiktokOrderId,
      status: result.status,
      error: result.error,
    });
  }
  return results;
}

export async function checkTiktokMessage(id: string) {
  const current = await prisma.creator.findUnique({ where: { id } });
  if (!current) return null;
  if (!current.tiktokOrderId.trim()) {
    return { state: "missing" as const, label: "Add a TikTok order ID to check the orders app." };
  }
  return readTiktokMessage(current.tiktokOrderId, current.tiktokMessage);
}

export async function deleteCreator(id: string) {
  try {
    await prisma.creator.delete({ where: { id } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return false;
    throw error;
  }
}

export async function inquiryCount() {
  return prisma.creator.count({ where: { stage: Stage.INQUIRY } });
}

export type MatchReport = {
  state: "ready" | "not_ready" | "not_configured" | "failed" | "busy";
  summary: string;
  lines: MatchLine[];
  review: ReviewItem[];
  unclaimed: UnclaimedOrder[];
  creators: CreatorDetail[];
};

let matchInflight: Promise<MatchReport> | null = null;

function blanket(ids: string[], state: MatchLine["state"], label: string): MatchLine[] {
  return ids.map((id) => ({ id, state, label }));
}

function reportFrom(
  state: MatchReport["state"],
  summary: string,
  lines: MatchLine[] = [],
  review: ReviewItem[] = [],
  creators: CreatorDetail[] = [],
  unclaimed: UnclaimedOrder[] = [],
): MatchReport {
  return { state, summary, lines, review, unclaimed, creators };
}

async function applyTiktokMatch(now: Date): Promise<MatchReport> {
  const rows = await prisma.creator.findMany({ orderBy: { name: "asc" } });
  const ids = rows.map((row) => row.id);
  const fetched = await opsGet("/api/machine/tiktok-orders");
  if (!fetched.ok && fetched.reason === "not_configured") {
    const summary = matchSummary({ state: "not_configured", matched: 0, needsReview: 0, noOrder: rows.length, unclaimed: 0 });
    return reportFrom("not_configured", summary, blanket(ids, "not_configured", summary));
  }
  if (!fetched.ok) {
    const summary = matchSummary({ state: "failed", error: "The orders app didn't respond.", matched: 0, needsReview: 0, noOrder: rows.length, unclaimed: 0 });
    return reportFrom("failed", summary, blanket(ids, "failed", summary));
  }
  const interpreted = interpretTiktokOrders(fetched.status, fetched.body);
  if (interpreted.state === "not_ready") {
    const summary = matchSummary({ state: "not_ready", matched: 0, needsReview: 0, noOrder: rows.length, unclaimed: 0 });
    return reportFrom("not_ready", summary, blanket(ids, "not_ready", summary));
  }
  if (interpreted.state === "failed") {
    const summary = matchSummary({ state: "failed", error: interpreted.error, matched: 0, needsReview: 0, noOrder: rows.length, unclaimed: 0 });
    return reportFrom("failed", summary, blanket(ids, "failed", summary));
  }

  const plan = planOrderMatches(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      tiktokOrderId: row.tiktokOrderId,
      tiktokMessage: row.tiktokMessage,
      opsStatus: row.opsStatus,
    })),
    interpreted.parcels,
  );
  const sentIds = new Set<string>();
  const failed: { id: string; error: string }[] = [];
  const touched = new Set<string>();
  for (const match of plan.matches) {
    const current = rows.find((row) => row.id === match.creatorId);
    if (!current) continue;
    const alreadyAligned = current.tiktokOrderId === match.parcel.tiktokOrderId;
    const posting = shouldPushSavedMessage(current.tiktokMessage, match.parcel.message);
    if (!alreadyAligned) {
      await prisma.creator.update({
        where: { id: current.id },
        data: {
          tiktokOrderId: match.parcel.tiktokOrderId,
          ...(!posting ? { opsStatus: "", opsError: "", opsSentAt: null } : {}),
          updatedAt: now,
          activities: { create: { detail: match.by === "id" ? "Matched the TikTok order by ID." : "Matched the TikTok order by name." } },
        },
      });
      current.tiktokOrderId = match.parcel.tiktokOrderId;
      touched.add(current.id);
    }
    if (!posting) continue;
    const result = await postTiktokMessage(current.tiktokOrderId, current.tiktokMessage, fetch, match.parcel.reference);
    await storeTiktokSend(current.id, current.tiktokOrderId, current.tiktokMessage, result, now);
    touched.add(current.id);
    if (result.status === "sent") sentIds.add(current.id);
    else failed.push({ id: current.id, error: result.error });
  }

  const lines = linesAfterSend(plan.lines, sentIds, failed);
  const matched = plan.matches.length;
  const sent = lines.filter((line) => line.state === "sent").length;
  const needsReview = lines.filter((line) => line.state === "needs_review").length;
  const noOrder = lines.filter((line) => line.state === "no_order").length;
  const failedCount = lines.filter((line) => line.state === "failed").length;
  const creators: CreatorDetail[] = [];
  for (const id of touched) {
    const creator = await getCreator(id);
    if (creator) creators.push(creator);
  }
  return reportFrom(
    "ready",
    matchSummary({
      state: "matched",
      matched,
      sent,
      needsReview,
      noOrder,
      unclaimed: plan.unclaimed.length,
      failed: failedCount,
    }),
    lines,
    [...interpreted.review, ...plan.review],
    creators,
    plan.unclaimed,
  );
}

export function matchTiktokOrders(now = new Date()) {
  if (matchInflight) return matchInflight;
  matchInflight = applyTiktokMatch(now).finally(() => {
    matchInflight = null;
  });
  return matchInflight;
}

export async function confirmTiktokOrder(creatorId: string, tiktokOrderId: string, now = new Date()) {
  const parsed = readTiktokOrderId(tiktokOrderId);
  if (!parsed.ok) return { ok: false as const, status: 400, error: parsed.error };
  if (!parsed.value) return { ok: false as const, status: 400, error: "Enter the TikTok order ID." };
  const current = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!current) return { ok: false as const, status: 404, error: "That creator isn't on the board." };
  const posting = current.tiktokMessage.trim() !== "" && !(current.opsStatus === "sent" && current.tiktokOrderId === parsed.value);
  if (current.tiktokOrderId !== parsed.value) {
    await prisma.creator.update({
      where: { id: creatorId },
      data: {
        tiktokOrderId: parsed.value,
        ...(!posting ? { opsStatus: "", opsError: "", opsSentAt: null } : {}),
        updatedAt: now,
        activities: { create: { detail: "Confirmed the TikTok order." } },
      },
    });
  }
  if (posting) {
    const result = await postTiktokMessage(parsed.value, current.tiktokMessage);
    await storeTiktokSend(creatorId, parsed.value, current.tiktokMessage, result, now);
  }
  const creator = await getCreator(creatorId);
  if (!creator) return { ok: false as const, status: 404, error: "That creator isn't on the board." };
  return { ok: true as const, creator };
}
