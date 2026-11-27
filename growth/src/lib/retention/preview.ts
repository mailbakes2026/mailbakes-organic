import { prisma, prepareDatabase } from "@/lib/prisma";
import { sanitizeEmailHtml } from "@/lib/retention/html";

export async function upsertPreview(campaignId: string, html: string, subject: string) {
  await prepareDatabase();
  const safe = sanitizeEmailHtml(html);
  if (!safe) return;
  const data = { html: safe, subject: subject.slice(0, 300) };
  await prisma.campaignPreview.upsert({
    where: { campaignId },
    create: { campaignId, ...data },
    update: data,
  });
}

export async function listPreviews(ids: string[]) {
  await prepareDatabase();
  if (!ids.length) return [];
  const rows = await prisma.campaignPreview.findMany({ where: { campaignId: { in: ids } } });
  return rows.map((row) => ({
    campaignId: row.campaignId,
    html: sanitizeEmailHtml(row.html),
    subject: row.subject,
    updatedAt: row.updatedAt,
  }));
}

export async function listPreviewStamps() {
  await prepareDatabase();
  return prisma.campaignPreview.findMany({ select: { campaignId: true, updatedAt: true } });
}
