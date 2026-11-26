import type { CalendarCampaign, Prisma, ReviewComment } from "@prisma/client";
import { eachDate } from "@/lib/dates";
import { prisma, prepareDatabase } from "@/lib/prisma";
import { CAMPAIGN_SEED, OFFER_SEED, TAG_SEED } from "@/lib/retention/calendar/seed";
import {
  dayParts,
  formatWeekRange,
  isChannel,
  isStatus,
  isTone,
  isVerdict,
  klaviyoCampaignUrl,
  rangeTitle,
  rollup,
  type CampaignJson,
  type DesignJson,
  type OfferInput,
  type OfferJson,
  type ResultsPatch,
  type ReviewJson,
  type SetupInput,
  type TagJson,
  type WeekJson,
} from "@/lib/retention/calendar/model";

const designSelect = {
  id: true,
  campaignId: true,
  filename: true,
  mimeType: true,
  size: true,
  uploadedBy: true,
  createdAt: true,
} as const;

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

async function seedOnce(seedKey: string, create: (tx: Prisma.TransactionClient) => Promise<void>) {
  const marked = await prisma.calendarSeedMark.findUnique({ where: { seedKey } });
  if (marked) return;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.calendarSeedMark.create({ data: { seedKey } });
      await create(tx);
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
  }
}

export async function ensureCalendarSeed() {
  await prepareDatabase();
  const marks = new Set((await prisma.calendarSeedMark.findMany({ select: { seedKey: true } })).map((row) => row.seedKey));
  for (const row of CAMPAIGN_SEED) {
    if (marks.has(row.seedKey)) continue;
    await seedOnce(row.seedKey, async (tx) => {
      const existing = await tx.calendarCampaign.findUnique({ where: { seedKey: row.seedKey } });
      if (!existing) await tx.calendarCampaign.create({ data: row });
    });
  }
  for (const row of OFFER_SEED) {
    if (marks.has(row.seedKey)) continue;
    await seedOnce(row.seedKey, async (tx) => {
      const existing = await tx.calendarOffer.findUnique({ where: { seedKey: row.seedKey } });
      if (!existing) await tx.calendarOffer.create({ data: row });
    });
  }
  for (const row of TAG_SEED) {
    if (marks.has(row.seedKey)) continue;
    await seedOnce(row.seedKey, async (tx) => {
      const existing = await tx.calendarDayTag.findUnique({ where: { seedKey: row.seedKey } });
      if (!existing) await tx.calendarDayTag.create({ data: row });
    });
  }
}

function designJson(row: { id: string; filename: string; mimeType: string; size: number; uploadedBy: string; createdAt: Date }): DesignJson {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function reviewJson(row: ReviewComment): ReviewJson {
  return {
    id: row.id,
    author: row.author,
    body: row.body,
    verdict: isVerdict(row.verdict) ? row.verdict : "comment",
    createdAt: row.createdAt.toISOString(),
  };
}

function campaignJson(row: CalendarCampaign, designs: DesignJson[], reviews: ReviewJson[]): CampaignJson {
  return {
    id: row.id,
    title: row.title,
    status: isStatus(row.status) ? row.status : "planned",
    channel: isChannel(row.channel) ? row.channel : "email",
    sendDate: row.sendDate,
    sendTime: row.sendTime,
    timeLabel: row.timeLabel,
    subject: row.subject,
    previewText: row.previewText,
    audience: row.audience,
    audienceSize: row.audienceSize,
    smartSending: row.smartSending,
    offerCode: row.offerCode,
    klaviyoCampaignId: row.klaviyoCampaignId,
    klaviyoUrl: klaviyoCampaignUrl(row.klaviyoCampaignId),
    notes: row.notes,
    cardNote: row.cardNote,
    sort: row.sort,
    results: {
      openRate: row.openRate,
      clickRate: row.clickRate,
      revenuePence: row.revenuePence,
      orders: row.orders,
      recipients: row.recipients,
      delivered: row.delivered,
      opens: row.opens,
      clicks: row.clicks,
      unsubscribes: row.unsubscribes,
      unsubscribeRate: row.unsubscribeRate,
      bounces: row.bounces,
      bounceRate: row.bounceRate,
      spamComplaints: row.spamComplaints,
      spamRate: row.spamRate,
      conversionRate: row.conversionRate,
      aovPence: row.aovPence,
      currency: row.currency || "GBP",
      attributionModel: row.attributionModel,
      attributionDetail: row.attributionDetail,
      source: row.resultsSource,
      syncedAt: row.resultsSyncedAt ? row.resultsSyncedAt.toISOString() : null,
      error: row.resultsError,
    },
    designs,
    reviews,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function decorate(rows: CalendarCampaign[]) {
  const ids = rows.map((row) => row.id);
  const [designs, reviews] = await Promise.all([
    ids.length ? prisma.designAsset.findMany({ where: { campaignId: { in: ids } }, select: designSelect, orderBy: { createdAt: "asc" } }) : [],
    ids.length ? prisma.reviewComment.findMany({ where: { campaignId: { in: ids } }, orderBy: { createdAt: "asc" } }) : [],
  ]);
  return rows.map((row) =>
    campaignJson(
      row,
      designs.filter((design) => design.campaignId === row.id).map(designJson),
      reviews.filter((review) => review.campaignId === row.id).map(reviewJson),
    ),
  );
}

export async function loadCalendar(from: string, to: string, meta: { today: string; klaviyoConnected: boolean; tokenConfigured: boolean }): Promise<WeekJson> {
  await ensureCalendarSeed();
  const [campaigns, offers, tags] = await Promise.all([
    prisma.calendarCampaign.findMany({
      where: { sendDate: { gte: from, lte: to } },
      orderBy: [{ sendDate: "asc" }, { sendTime: "asc" }, { sort: "asc" }, { title: "asc" }],
    }),
    prisma.calendarOffer.findMany({
      where: { startDate: { lte: to }, endDate: { gte: from } },
      orderBy: [{ sort: "asc" }, { label: "asc" }],
    }),
    prisma.calendarDayTag.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { label: "asc" },
    }),
  ]);
  const decorated = await decorate(campaigns);
  const byDate = new Map<string, CampaignJson[]>();
  for (const campaign of decorated) {
    const list = byDate.get(campaign.sendDate) ?? [];
    list.push(campaign);
    byDate.set(campaign.sendDate, list);
  }
  const tagsByDate = new Map<string, TagJson[]>();
  for (const tag of tags) {
    const list = tagsByDate.get(tag.date) ?? [];
    list.push({ id: tag.id, date: tag.date, label: tag.label });
    tagsByDate.set(tag.date, list);
  }
  const days = eachDate(from, to).map((date) => {
    const parts = dayParts(date);
    return {
      date,
      weekday: parts.weekday,
      month: parts.month,
      day: parts.day,
      tags: tagsByDate.get(date) ?? [],
      campaigns: byDate.get(date) ?? [],
    };
  });
  const offerJson: OfferJson[] = offers.map((offer) => ({
    id: offer.id,
    label: offer.label,
    startDate: offer.startDate,
    endDate: offer.endDate,
    tone: isTone(offer.tone) ? offer.tone : "pink",
    sort: offer.sort,
  }));
  return {
    from,
    to,
    title: rangeTitle(from, to),
    rangeLabel: formatWeekRange(from, to),
    today: meta.today,
    klaviyoConnected: meta.klaviyoConnected,
    tokenConfigured: meta.tokenConfigured,
    days,
    offers: offerJson,
    rollup: rollup(decorated.map((campaign) => ({ ...campaign.results, delivered: campaign.results.delivered }))),
  };
}

export async function getCampaign(id: string) {
  await ensureCalendarSeed();
  const row = await prisma.calendarCampaign.findUnique({ where: { id } });
  if (!row) return null;
  const [campaign] = await decorate([row]);
  return campaign ?? null;
}

export async function createCampaign(input: SetupInput) {
  await ensureCalendarSeed();
  const row = await prisma.calendarCampaign.create({ data: input });
  const [campaign] = await decorate([row]);
  return campaign ?? null;
}

export async function updateCampaign(id: string, input: Partial<SetupInput>) {
  const existing = await prisma.calendarCampaign.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.calendarCampaign.update({ where: { id }, data: input });
  const [campaign] = await decorate([row]);
  return campaign ?? null;
}

export async function saveManualResults(id: string, patch: ResultsPatch) {
  const existing = await prisma.calendarCampaign.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.calendarCampaign.update({
    where: { id },
    data: { ...patch, resultsSource: "manual", resultsError: "", resultsSyncedAt: null },
  });
  const [campaign] = await decorate([row]);
  return campaign ?? null;
}

export async function deleteCampaign(id: string) {
  const existing = await prisma.calendarCampaign.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.calendarCampaign.delete({ where: { id } });
  return true;
}

export async function createOffer(input: OfferInput) {
  await ensureCalendarSeed();
  if (input.startDate > input.endDate) return { error: "Offer start must be on or before the end." as const };
  const offer = await prisma.calendarOffer.create({ data: input });
  return { offer: offerJson(offer) };
}

export async function updateOffer(id: string, input: Partial<OfferInput>) {
  const existing = await prisma.calendarOffer.findUnique({ where: { id } });
  if (!existing) return null;
  const startDate = input.startDate ?? existing.startDate;
  const endDate = input.endDate ?? existing.endDate;
  if (startDate > endDate) return { error: "Offer start must be on or before the end." as const };
  const offer = await prisma.calendarOffer.update({ where: { id }, data: input });
  return { offer: offerJson(offer) };
}

export async function deleteOffer(id: string) {
  const existing = await prisma.calendarOffer.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.calendarOffer.delete({ where: { id } });
  return true;
}

function offerJson(offer: { id: string; label: string; startDate: string; endDate: string; tone: string; sort: number }): OfferJson {
  return {
    id: offer.id,
    label: offer.label,
    startDate: offer.startDate,
    endDate: offer.endDate,
    tone: isTone(offer.tone) ? offer.tone : "pink",
    sort: offer.sort,
  };
}

export async function createTag(input: { date: string; label: string }) {
  await ensureCalendarSeed();
  try {
    const tag = await prisma.calendarDayTag.create({ data: input });
    return { tag: { id: tag.id, date: tag.date, label: tag.label } };
  } catch (error) {
    if (isUnique(error)) return { error: "That tag is already on this day." as const };
    throw error;
  }
}

export async function deleteTag(id: string) {
  const existing = await prisma.calendarDayTag.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.calendarDayTag.delete({ where: { id } });
  return true;
}

export async function addDesign(input: { campaignId: string; filename: string; mimeType: string; bytes: Buffer; uploadedBy: string }) {
  const campaign = await prisma.calendarCampaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign) return null;
  const row = await prisma.designAsset.create({
    data: {
      campaignId: input.campaignId,
      filename: input.filename,
      mimeType: input.mimeType,
      bytes: Uint8Array.from(input.bytes),
      size: input.bytes.length,
      uploadedBy: input.uploadedBy,
    },
    select: designSelect,
  });
  return designJson(row);
}

export async function getDesign(id: string) {
  return prisma.designAsset.findUnique({ where: { id } });
}

export async function deleteDesign(id: string) {
  const existing = await prisma.designAsset.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;
  await prisma.designAsset.delete({ where: { id } });
  return true;
}

export async function addReview(campaignId: string, input: { author: string; body: string; verdict: string; status?: string }) {
  const campaign = await prisma.calendarCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.reviewComment.create({
      data: { campaignId, author: input.author, body: input.body, verdict: input.verdict },
    });
    if (input.status) await tx.calendarCampaign.update({ where: { id: campaignId }, data: { status: input.status } });
    return created;
  });
  const updated = await getCampaign(campaignId);
  return { review: reviewJson(review), campaign: updated };
}

export async function deleteReview(id: string) {
  const existing = await prisma.reviewComment.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.reviewComment.delete({ where: { id } });
  return true;
}

export async function campaignsForSync(filter: { campaignId?: string; from?: string; to?: string }) {
  await ensureCalendarSeed();
  if (filter.campaignId) {
    const row = await prisma.calendarCampaign.findUnique({ where: { id: filter.campaignId } });
    return row ? [row] : [];
  }
  return prisma.calendarCampaign.findMany({
    where: {
      klaviyoCampaignId: { not: "" },
      ...(filter.from && filter.to ? { sendDate: { gte: filter.from, lte: filter.to } } : {}),
    },
    orderBy: { sendDate: "asc" },
  });
}

export async function saveKlaviyoResults(
  id: string,
  patch: ResultsPatch & { currency: string; attributionDetail: string },
) {
  await prisma.calendarCampaign.update({
    where: { id },
    data: {
      ...patch,
      resultsSource: "klaviyo",
      resultsError: "",
      resultsSyncedAt: new Date(),
    },
  });
}

export async function saveResultsError(id: string, resultsError: string) {
  await prisma.calendarCampaign.update({ where: { id }, data: { resultsError } });
}
