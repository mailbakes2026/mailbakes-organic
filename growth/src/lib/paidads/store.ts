import { addDays, londonToday } from "@/lib/dates";
import { prisma, prepareDatabase } from "@/lib/prisma";
import type { IngestRow } from "@/lib/paidads/ingest";
import type { ParsedInsight } from "@/lib/paidads/meta-parse";

export async function ready() {
  await prepareDatabase();
}

type RowInput = IngestRow | ParsedInsight;

function key(row: RowInput) {
  return {
    platform: row.platform,
    level: row.level,
    date: row.date,
    campaignId: row.campaignId,
    adsetId: row.adsetId,
  };
}

export async function upsertAdRows(rows: RowInput[]) {
  await ready();
  await prisma.$transaction(
    async (tx) => {
      for (const row of rows) {
        await tx.adRow.upsert({
          where: { platform_level_date_campaignId_adsetId: key(row) },
          create: row,
          update: {
            campaignName: row.campaignName,
            adsetName: row.adsetName,
            spendPence: row.spendPence,
            revenuePence: row.revenuePence,
            orders: row.orders,
            impressions: row.impressions,
            clicks: row.clicks,
            currency: row.currency,
            source: row.source,
          },
        });
      }
    },
    { timeout: 60_000 },
  );
}

export async function listRecentAdRows(now = new Date()) {
  await ready();
  const from = addDays(londonToday(now), -120);
  return prisma.adRow.findMany({ where: { date: { gte: from } }, orderBy: { date: "asc" } });
}

export async function writeSync(id: string, status: "ok" | "error", detail: string) {
  await ready();
  await prisma.syncState.upsert({
    where: { id },
    create: { id, status, detail: detail.slice(0, 500), syncedAt: status === "ok" ? new Date() : null },
    update: { status, detail: detail.slice(0, 500), syncedAt: status === "ok" ? new Date() : undefined },
  });
}

export async function readSync(id: string) {
  await ready();
  return prisma.syncState.findUnique({ where: { id } });
}

export async function listChanges() {
  await ready();
  return prisma.budgetChange.findMany({ orderBy: [{ day: "desc" }, { updatedAt: "desc" }] });
}

export async function listNotes(app: string, kind: string) {
  await ready();
  return prisma.note.findMany({ where: { app, kind }, orderBy: { createdAt: "desc" } });
}
