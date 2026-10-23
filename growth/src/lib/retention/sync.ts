import { londonToday } from "@/lib/dates";
import { klaviyoMissing, shopifyMissing } from "@/lib/env";
import { pullKlaviyo } from "@/lib/retention/klaviyo";
import { pullShopifyOrders } from "@/lib/retention/shopify";
import { readSync, replaceOrders, replaceSends, upsertLists, writeSync } from "@/lib/retention/store";
import { logSafe, scrub } from "@/lib/scrub";

let klaviyoPending: Promise<{ ok: true; detail: string } | { ok: false; error: string }> | null = null;
let shopifyPending: Promise<{ ok: true; detail: string } | { ok: false; error: string }> | null = null;

export async function syncKlaviyo(now = new Date()) {
  const missing = klaviyoMissing();
  if (missing.length) return { ok: false as const, error: "Klaviyo is not connected. Set KLAVIYO_PRIVATE_API_KEY." };
  try {
    const pulled = await pullKlaviyo(process.env.KLAVIYO_PRIVATE_API_KEY!.trim());
    await replaceSends("flow", "klaviyo", pulled.flows, ["7d", "30d"]);
    await replaceSends("campaign", "klaviyo", pulled.campaigns, ["7d", "30d"]);
    const capturedOn = londonToday(now);
    await upsertLists(pulled.lists.map((list) => ({ ...list, capturedOn, source: "klaviyo" })));
    const notes = [
      `Stored ${pulled.flows.length} flow rows and ${pulled.campaigns.length} campaign rows.`,
      pulled.lists.length ? `Recorded ${pulled.lists.length} lists for ${capturedOn}.` : "Klaviyo returned no lists.",
      pulled.countsMissing ? "Klaviyo did not return a profile count." : "",
      pulled.namesMissing ? "Some flow or campaign names were not returned, so the id is shown." : "",
    ].filter(Boolean);
    const detail = notes.join(" ");
    await writeSync("retention-klaviyo", "ok", detail);
    return { ok: true as const, detail };
  } catch (error) {
    logSafe("klaviyo sync", error);
    const message = scrub(error instanceof Error ? error.message : "Klaviyo sync failed.");
    await writeSync("retention-klaviyo", "error", message).catch((writeError) => logSafe("klaviyo sync state", writeError));
    return { ok: false as const, error: message };
  }
}

export function syncKlaviyoLocked() {
  klaviyoPending ??= syncKlaviyo().finally(() => {
    klaviyoPending = null;
  });
  return klaviyoPending;
}

export async function syncShopify(now = new Date()) {
  const missing = shopifyMissing();
  if (missing.length) return { ok: false as const, error: `Shopify is not connected. Set ${missing.join(", ")}.` };
  try {
    const pulled = await pullShopifyOrders({
      shopDomain: process.env.SHOPIFY_SHOP!.trim(),
      clientId: process.env.SHOPIFY_CLIENT_ID!.trim(),
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET!.trim(),
      now,
    });
    const guests = pulled.orders.filter((order) => order.guest).length;
    await replaceOrders(
      "shopify",
      pulled.orders.map((order) => ({
        id: order.id,
        customerId: order.customerId,
        orderedOn: order.orderedOn,
        totalPence: order.totalPence,
        currency: order.currency,
        source: "shopify" as const,
      })),
      !pulled.truncated,
    );
    const detail = [
      `${pulled.shop}. Stored ${pulled.orders.length - guests} non-cancelled orders with a customer, from ${pulled.since}.`,
      guests ? `${guests} orders had no customer and are excluded from repeat rate and cohorts.` : "",
      pulled.skipped ? `${pulled.skipped} orders were skipped because the total or date was missing.` : "",
      pulled.truncated ? "Stopped at 3,000 orders. Older Shopify orders already stored were kept. Repeat rate covers this stored set only." : "",
    ]
      .filter(Boolean)
      .join(" ");
    await writeSync("retention-shopify", "ok", detail);
    return { ok: true as const, detail };
  } catch (error) {
    logSafe("shopify sync", error);
    const message = scrub(error instanceof Error ? error.message : "Shopify sync failed.");
    await writeSync("retention-shopify", "error", message).catch((writeError) => logSafe("shopify sync state", writeError));
    return { ok: false as const, error: message };
  }
}

export function syncShopifyLocked() {
  shopifyPending ??= syncShopify().finally(() => {
    shopifyPending = null;
  });
  return shopifyPending;
}

async function stale(id: string, now: Date) {
  const state = await readSync(id);
  if (state?.status === "ok" && state.syncedAt && now.getTime() - state.syncedAt.getTime() < 6 * 60 * 60 * 1000) return false;
  return true;
}

export async function syncRetentionIfStale(now = new Date()) {
  const jobs: Promise<unknown>[] = [];
  if (!klaviyoMissing().length && (await stale("retention-klaviyo", now))) jobs.push(syncKlaviyoLocked());
  if (!shopifyMissing().length && (await stale("retention-shopify", now))) jobs.push(syncShopifyLocked());
  if (jobs.length) await Promise.all(jobs);
}
