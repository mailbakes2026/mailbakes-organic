import { klaviyoPrivateKey } from "@/lib/env";
import { KLAVIYO_ATTRIBUTION_DETAIL, reportWindow } from "@/lib/retention/calendar/model";
import { campaignsForSync, saveKlaviyoResults, saveResultsError } from "@/lib/retention/calendar/store";
import { pullCampaignPerformance } from "@/lib/retention/klaviyo";
import type { CampaignPerformance } from "@/lib/retention/klaviyo-parse";

const NO_RESULTS = "Klaviyo returned no results for this campaign yet. The stored snapshot is unchanged.";

function hasSignal(row: CampaignPerformance) {
  return [row.recipients, row.delivered, row.opens, row.clicks, row.revenuePence, row.orders, row.unsubscribes, row.bounces, row.spamComplaints].some(
    (value) => value !== null,
  );
}

export async function syncCalendarResults(filter: { campaignId?: string; from?: string; to?: string }) {
  const key = klaviyoPrivateKey();
  if (!key) {
    return { ok: false as const, status: 503, error: "Klaviyo is not connected. Set KLAVIYO_PRIVATE_API_KEY or KLAVIYO_PRIVATE_KEY. Stored snapshots are unchanged." };
  }
  const campaigns = await campaignsForSync(filter);
  if (filter.campaignId && !campaigns.length) return { ok: false as const, status: 404, error: "That campaign was not found." };
  const linked = campaigns.filter((campaign) => /^[A-Za-z0-9]{6,32}$/.test(campaign.klaviyoCampaignId));
  if (!linked.length) {
    return {
      ok: true as const,
      currency: "GBP",
      updated: [] as string[],
      unchanged: [] as { id: string; title: string; reason: string }[],
      message: "No Klaviyo campaign IDs to sync. Stored snapshots are unchanged.",
    };
  }
  if (linked.length > 100) {
    return { ok: false as const, status: 400, error: "Sync 100 campaigns at a time. Pass a week, or a from and to range." };
  }
  const pulled = await pullCampaignPerformance(
    key,
    linked.map((campaign) => campaign.klaviyoCampaignId),
    reportWindow(linked.map((campaign) => campaign.sendDate)),
  );
  const byId = new Map(pulled.rows.map((row) => [row.campaignId, row]));
  const updated: string[] = [];
  const unchanged: { id: string; title: string; reason: string }[] = [];
  for (const campaign of linked) {
    const row = byId.get(campaign.klaviyoCampaignId);
    if (!row || !hasSignal(row)) {
      await saveResultsError(campaign.id, NO_RESULTS);
      unchanged.push({ id: campaign.id, title: campaign.title, reason: NO_RESULTS });
      continue;
    }
    await saveKlaviyoResults(campaign.id, {
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
      currency: pulled.currency,
      attributionDetail: KLAVIYO_ATTRIBUTION_DETAIL,
    });
    updated.push(campaign.id);
  }
  return { ok: true as const, currency: pulled.currency, updated, unchanged };
}
