import { logSafe } from "@/lib/scrub";
import type { SendFact } from "@/lib/retention/metrics";
import { listOrders, listSends, listSnapshots, readSync } from "@/lib/retention/store";
import { buildRetentionView } from "@/lib/retention/view";

export async function loadRetention() {
  try {
    const [sends, lists, orders, klaviyo, shopify] = await Promise.all([
      listSends(),
      listSnapshots(),
      listOrders(),
      readSync("retention-klaviyo"),
      readSync("retention-shopify"),
    ]);
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
    return { ok: true as const, view, klaviyo, shopify };
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
