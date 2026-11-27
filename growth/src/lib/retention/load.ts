import { londonToday } from "@/lib/dates";
import { metaMissing } from "@/lib/env";
import { syncMetaIfStale } from "@/lib/paidads/sync";
import { listRecentAdRows } from "@/lib/paidads/store";
import { buildMetaSnapshot } from "@/lib/paidads/snapshot";
import { invalidateRetentionCache, readRetentionMemory, retentionGeneration, writeRetentionMemory } from "@/lib/retention/cache";
import type { SendFact } from "@/lib/retention/metrics";
import { listDatedCampaignRevenue, listPulses, savePulse } from "@/lib/retention/pulse";
import { listOrders, listSends, listSnapshots, readSync } from "@/lib/retention/store";
import { syncRetentionIfStale } from "@/lib/retention/sync";
import { buildRetentionView } from "@/lib/retention/view";
import { emptyWeekStory, sumMoney, trailingRepeat, weekStory, type PulsePoint, type WeekStory } from "@/lib/retention/weeks";
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
      weeks: WeekStory;
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
    const today = londonToday();
    const orderFacts = orders.map((order) => ({
      customerId: order.customerId,
      orderedOn: order.orderedOn,
      totalPence: order.totalPence,
      currency: order.currency,
    }));
    const meta = buildMetaSnapshot({ rows: adRows, orders: orderFacts, today });
    const view = buildRetentionView({
      today,
      orders: orders.map((order) => ({
        id: order.id,
        customerId: order.customerId,
        orderedOn: order.orderedOn,
        totalPence: order.totalPence,
        currency: order.currency,
      })),
      lists: lists.map((list) => ({
        listId: list.listId,
        listName: list.listName,
        profiles: list.profiles,
        capturedOn: list.capturedOn,
      })),
      flows: sends.flows.map(toSend),
      campaigns: sends.campaigns.map(toSend),
    });
    const weeks = await rememberWeek(view, orders, today);
    return { ok: true, view, klaviyo, shopify, meta, metaConnected: metaMissing().length === 0, weeks };
  } catch (error) {
    logSafe("retention", error);
    return { ok: false };
  }
}

async function rememberWeek(
  view: ReturnType<typeof buildRetentionView>,
  orders: { customerId: string; orderedOn: string }[],
  today: string,
): Promise<WeekStory> {
  const flowMoney = sumMoney(view.flows["7d"]);
  const campaignMoney = sumMoney(view.campaigns["7d"]);
  const repeat = trailingRepeat(orders, today);
  const currencies = [flowMoney, campaignMoney].filter((money) => money.pence !== null && !money.mixed).map((money) => money.currency);
  const mixed = flowMoney.mixed || campaignMoney.mixed || new Set(currencies).size > 1;
  const current: PulsePoint = {
    capturedOn: today,
    flowRevenuePence: flowMoney.mixed ? null : flowMoney.pence,
    campaignRevenuePence: campaignMoney.mixed ? null : campaignMoney.pence,
    currency: currencies[0] ?? "GBP",
    mixedCurrency: mixed,
    repeatRate: repeat?.rate ?? null,
    repeatCustomers: repeat?.repeatCustomers ?? null,
    customers: repeat?.customers ?? null,
  };
  try {
    await savePulse(current);
    const [pulses, dated] = await Promise.all([listPulses(), listDatedCampaignRevenue()]);
    return weekStory({
      today,
      current,
      pulses,
      calendar: dated.map((row) => ({ sendDate: row.sendDate, revenuePence: row.revenuePence, currency: row.currency })),
    });
  } catch (error) {
    logSafe("retention weeks", error);
    return emptyWeekStory(today);
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
  status?: string;
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
    status: row.status ?? "",
    updatedAt: row.updatedAt.toISOString(),
  };
}
