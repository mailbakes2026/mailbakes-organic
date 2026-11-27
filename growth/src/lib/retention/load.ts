import { londonToday } from "@/lib/dates";
import { metaMissing } from "@/lib/env";
import { syncMetaIfStale } from "@/lib/paidads/sync";
import { listRecentAdRows } from "@/lib/paidads/store";
import { buildMetaSnapshot } from "@/lib/paidads/snapshot";
import { invalidateRetentionCache, readRetentionMemory, retentionGeneration, writeRetentionMemory } from "@/lib/retention/cache";
import type { SendFact } from "@/lib/retention/metrics";
import { listOrders, listSends, listSnapshots, readSync } from "@/lib/retention/store";
import { syncRetentionIfStale } from "@/lib/retention/sync";
import { buildRetentionView } from "@/lib/retention/view";
import { logSafe } from "@/lib/scrub";

const FRESH_MS = 20_000;

type Loaded =
  | {
      ok: true;
      view: ReturnType<typeof buildRetentionView>;
      klaviyo: Awaited<ReturnType<typeof readSync>>;
      shopify: Awaited<ReturnType<typeof readSync>>;
      meta: ReturnType<typeof buildMetaSnapshot>;
      metaConnected: boolean;
    }
  | { ok: false };

let reading: Promise<Loaded> | null = null;
let refreshCheckedAt = 0;

export async function loadRetention() {
  const cached = readRetentionMemory<Loaded>(FRESH_MS);
  if (cached?.ok) {
    scheduleRefresh();
    return cached;
  }
  if (!reading) {
    const seen = retentionGeneration();
    reading = readRetention()
      .then((value) => {
        if (value.ok) writeRetentionMemory(value, Date.now(), seen);
        return value;
      })
      .finally(() => {
        reading = null;
      });
  }
  const value = await reading;
  scheduleRefresh();
  return value;
}

function scheduleRefresh() {
  const now = Date.now();
  if (now - refreshCheckedAt < 30_000) return;
  refreshCheckedAt = now;
  // Stored rows render immediately. A stale sync updates them in the background.
  void syncRetentionIfStale().catch((error) => logSafe("retention sync", error));
  void syncMetaIfStale()
    .then((result) => {
      if (result) invalidateRetentionCache();
    })
    .catch((error) => logSafe("meta sync", error));
}

async function readRetention(): Promise<Loaded> {
  try {
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
    return { ok: true, view, klaviyo, shopify, meta, metaConnected: metaMissing().length === 0 };
  } catch (error) {
    logSafe("retention", error);
    return { ok: false };
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
