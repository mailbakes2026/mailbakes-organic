import { londonStamp } from "@/lib/dates";
import { klaviyoPrivateKey } from "@/lib/env";
import { klaviyoReportContext, pullCampaignPreview, pullWindowValues } from "@/lib/retention/klaviyo";
import { listPreviewStamps, upsertPreview } from "@/lib/retention/preview";
import { savePulse, savePulseRepeat } from "@/lib/retention/pulse";
import { listOrders, replaceSends } from "@/lib/retention/store";
import { historyTargets, sumMoney, windowRepeat } from "@/lib/retention/weeks";
import { logSafe } from "@/lib/scrub";

const WEEK_BUDGET_MS = 20_000;
const PREVIEW_BUDGET_MS = 12_000;
const PREVIEW_CAP = 16;
const PREVIEW_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

type OrderRow = { customerId: string; orderedOn: string };

export async function writeRepeatHistory(orders: OrderRow[], today: string) {
  const seen = new Set<string>();
  for (const target of historyTargets(today, 8)) {
    const repeat = windowRepeat(orders, target.start, target.end);
    for (const capturedOn of target.capturedOn) {
      if (seen.has(capturedOn) || capturedOn === today) continue;
      seen.add(capturedOn);
      await savePulseRepeat(capturedOn, repeat);
    }
  }
}

export async function backfillKlaviyoHistory(input: {
  today: string;
  orders: OrderRow[];
  flowNames: Map<string, string>;
  campaignNames: Map<string, string>;
  campaignIds: string[];
}) {
  await writeRepeatHistory(input.orders, input.today);
  const key = klaviyoPrivateKey();
  if (!key) return { weeks: 0, previews: 0 };
  let weeks = 0;
  try {
    const context = await klaviyoReportContext(key);
    const started = Date.now();
    for (const target of historyTargets(input.today, 8)) {
      if (Date.now() - started > WEEK_BUDGET_MS) break;
      const start = londonStamp(target.start, false);
      const end = londonStamp(target.end, true);
      if (!start || !end) continue;
      try {
        const pulled = await pullWindowValues(key, context.metricId, { start, end }, AbortSignal.timeout(10_000));
        for (const row of pulled.flows) {
          row.name = input.flowNames.get(row.id) ?? row.name;
          if (!/^[A-Z]{3}$/.test(row.currency)) row.currency = context.currency;
        }
        for (const row of pulled.campaigns) {
          row.name = input.campaignNames.get(row.id) ?? row.name;
          if (!/^[A-Z]{3}$/.test(row.currency)) row.currency = context.currency;
        }
        const flow = sumMoney(pulled.flows);
        const campaign = sumMoney(pulled.campaigns);
        const currencies = [flow, campaign].filter((money) => money.pence !== null && !money.mixed).map((money) => money.currency);
        const mixed = flow.mixed || campaign.mixed || new Set(currencies).size > 1;
        const repeat = windowRepeat(input.orders, target.start, target.end);
        for (const capturedOn of target.capturedOn) {
          await savePulse({
            capturedOn,
            flowRevenuePence: flow.mixed ? null : flow.pence,
            campaignRevenuePence: campaign.mixed ? null : campaign.pence,
            currency: currencies[0] ?? context.currency,
            mixedCurrency: mixed,
            repeatRate: repeat?.rate ?? null,
            repeatCustomers: repeat?.repeatCustomers ?? null,
            customers: repeat?.customers ?? null,
          });
        }
        if (target.storeSends) {
          await replaceSends("flow", "klaviyo", pulled.flows, ["prev7d"]);
          await replaceSends("campaign", "klaviyo", pulled.campaigns, ["prev7d"]);
        }
        weeks += 1;
      } catch (error) {
        logSafe("retention week", error);
      }
    }
  } catch (error) {
    logSafe("retention history", error);
  }
  const previews = await backfillPreviews(key, input.campaignIds);
  return { weeks, previews };
}

async function backfillPreviews(key: string, campaignIds: string[]) {
  const ids = [...new Set(campaignIds.filter((id) => /^[A-Za-z0-9]{6,32}$/.test(id)))].slice(0, PREVIEW_CAP);
  if (!ids.length) return 0;
  let stamps: { campaignId: string; updatedAt: Date }[] = [];
  try {
    stamps = await listPreviewStamps();
  } catch (error) {
    logSafe("campaign preview stamps", error);
  }
  const fresh = new Set(stamps.filter((row) => Date.now() - row.updatedAt.getTime() < PREVIEW_FRESH_MS).map((row) => row.campaignId));
  const started = Date.now();
  let saved = 0;
  for (const id of ids) {
    if (fresh.has(id) || Date.now() - started > PREVIEW_BUDGET_MS) continue;
    try {
      const preview = await pullCampaignPreview(key, id, AbortSignal.timeout(8_000));
      if (!preview) continue;
      await upsertPreview(id, preview.html, preview.subject);
      saved += 1;
    } catch (error) {
      logSafe("campaign preview", error);
    }
  }
  return saved;
}

export async function backfillRepeatFromStore(today: string) {
  const orders = await listOrders();
  await writeRepeatHistory(
    orders.map((order) => ({ customerId: order.customerId, orderedOn: order.orderedOn })),
    today,
  );
}
