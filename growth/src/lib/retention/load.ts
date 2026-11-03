import { londonToday } from "@/lib/dates";
import { metaMissing } from "@/lib/env";
import { logSafe } from "@/lib/scrub";
import { listRecentAdRows } from "@/lib/paidads/store";
import { buildMetaSnapshot } from "@/lib/paidads/snapshot";
import { syncMetaIfStale } from "@/lib/paidads/sync";
import type { SendFact } from "@/lib/retention/metrics";
import { listOrders, listSends, listSnapshots, readSync } from "@/lib/retention/store";
import { syncRetentionIfStale } from "@/lib/retention/sync";
import { buildRetentionView } from "@/lib/retention/view";

export async function loadRetention() {
  try {
    await Promise.all([
      syncRetentionIfStale().catch((error) => logSafe("retention sync", error)),
      syncMetaIfStale().catch((error) => logSafe("meta sync", error)),
    ]);
    const [sends, lists, orders, adRows, klaviyo, shopify] = await Promise.all([
      listSends(),
      listSnapshots(),
      listOrders(),
      listRecentAdRows(),
      readSync("retention-klaviyo"),
      readSync("retention-shopify"),
    ]);
    const orderFacts = orders.map((order) => ({
      customerId: order.customerId,
      orderedOn: order.orderedOn,
      totalPence: order.totalPence,
      currency: order.currency,
    }));
    const meta = buildMetaSnapshot({ rows: adRows, orders: orderFacts, today: londonToday() });
    const view = buildRetentionView({
      orders: orders.map((order) => ({ id: order.id, customerId: order.customerId, orderedOn: order.orderedOn })),
      lists: lists.map((list) => ({
        listId: list.listId,
        listName: list.listName,
        profiles: list.profiles,
        capturedOn: list.capturedOn,
      })),
      flows: sends.flows.map(toSend),
      campaigns: sends.campaigns.map(toSend),
    });
    return { ok: true as const, view, klaviyo, shopify, meta, metaConnected: metaMissing().length === 0 };
  } catch (error) {
    logSafe("retention", error);
    return { ok: false as const };
  }
}

function toSend(row: {
  flowId?: string;
  campaignId?: string;
  flowName?: string;
  campaignName?: string;
  window: string;
  revenuePence: number | null;
  opens: number | null;
  clicks: number | null;
  delivered: number | null;
  unsubscribes: number | null;
  openRate: number | null;
  clickRate: number | null;
  currency: string;
  source: string;
  updatedAt: Date;
}): SendFact {
  return {
    id: row.flowId || row.campaignId || "",
    name: row.flowName || row.campaignName || "",
    window: row.window,
    revenuePence: row.revenuePence,
    opens: row.opens,
    clicks: row.clicks,
    delivered: row.delivered,
    unsubscribes: row.unsubscribes,
    openRate: row.openRate,
    clickRate: row.clickRate,
    currency: row.currency,
    source: row.source,
    updatedAt: row.updatedAt.toISOString(),
  };
}
