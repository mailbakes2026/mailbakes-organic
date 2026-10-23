import { prisma, prepareDatabase } from "@/lib/prisma";
import type { IngestList, IngestOrder, IngestSend } from "@/lib/retention/ingest";
import type { SendDraft } from "@/lib/retention/klaviyo-parse";
import type { ParsedOrder } from "@/lib/retention/shopify-parse";

async function ready() {
  await prepareDatabase();
}

export async function replaceSends(
  kind: "flow" | "campaign",
  source: string,
  rows: Array<IngestSend | SendDraft>,
  windows?: string[],
) {
  await ready();
  const windowFilter = windows ?? [...new Set(rows.map((row) => row.window))];
  await prisma.$transaction(
    async (tx) => {
    if (kind === "flow") {
      await tx.flowStat.deleteMany({ where: { source, window: { in: windowFilter } } });
      for (const row of rows) {
        await tx.flowStat.create({
          data: {
            flowId: row.id,
            flowName: row.name,
            window: row.window,
            revenuePence: row.revenuePence,
            opens: row.opens,
            clicks: row.clicks,
            delivered: row.delivered,
            unsubscribes: row.unsubscribes,
            openRate: row.openRate,
            clickRate: row.clickRate,
            currency: row.currency,
            source,
          },
        });
      }
      return;
    }
    await tx.campaignStat.deleteMany({ where: { source, window: { in: windowFilter } } });
    for (const row of rows) {
      await tx.campaignStat.create({
        data: {
          campaignId: row.id,
          campaignName: row.name,
          window: row.window,
          revenuePence: row.revenuePence,
          opens: row.opens,
          clicks: row.clicks,
          delivered: row.delivered,
          unsubscribes: row.unsubscribes,
          openRate: row.openRate,
          clickRate: row.clickRate,
          currency: row.currency,
          source,
        },
      });
    }
    },
    { timeout: 60_000 },
  );
}

export async function upsertLists(rows: Array<IngestList | { listId: string; listName: string; profiles: number | null; capturedOn: string; source: string }>) {
  await ready();
  for (const row of rows) {
    await prisma.listSnapshot.upsert({
      where: { listId_capturedOn_source: { listId: row.listId, capturedOn: row.capturedOn, source: row.source } },
      create: row,
      update: { listName: row.listName, profiles: row.profiles },
    });
  }
}

export async function replaceOrders(source: string, rows: Array<IngestOrder | Omit<ParsedOrder, "guest">>, removeMissing: boolean) {
  await ready();
  await prisma.$transaction(
    async (tx) => {
    if (removeMissing) {
      const ids = rows.map((row) => row.id);
      await tx.shopifyOrder.deleteMany({ where: { source, id: { notIn: ids.length ? ids : ["__none__"] } } });
    }
    for (const row of rows) {
      await tx.shopifyOrder.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          customerId: row.customerId,
          orderedOn: row.orderedOn,
          totalPence: row.totalPence,
          currency: row.currency,
          source,
        },
        update: {
          customerId: row.customerId,
          orderedOn: row.orderedOn,
          totalPence: row.totalPence,
          currency: row.currency,
          source,
        },
      });
    }
    },
    { timeout: 60_000 },
  );
}

export async function listSends() {
  await ready();
  const [flows, campaigns] = await Promise.all([
    prisma.flowStat.findMany(),
    prisma.campaignStat.findMany(),
  ]);
  return { flows, campaigns };
}

export async function listSnapshots() {
  await ready();
  return prisma.listSnapshot.findMany({ orderBy: { capturedOn: "asc" } });
}

export async function listOrders() {
  await ready();
  return prisma.shopifyOrder.findMany({ orderBy: { orderedOn: "asc" } });
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

const Q4 = [
  { title: "Flows", sort: 1 },
  { title: "Campaigns", sort: 2 },
  { title: "List growth", sort: 3 },
  { title: "Repeat purchase", sort: 4 },
  { title: "Cohorts", sort: 5 },
];

export async function ensurePlan() {
  await ready();
  const count = await prisma.planItem.count({ where: { quarter: "2026-Q4" } });
  if (count > 0) return;
  await prisma.planItem.createMany({
    data: Q4.map((item) => ({
      quarter: "2026-Q4",
      title: item.title,
      sort: item.sort,
      ownerName: "Kyle",
      ownerEmail: "kyle@flowsha.com",
    })),
  });
}

export async function listPlan() {
  await ensurePlan();
  return prisma.planItem.findMany({ where: { quarter: "2026-Q4" }, orderBy: { sort: "asc" } });
}
