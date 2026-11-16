import { londonToday } from "@/lib/dates";
import { metaMissing } from "@/lib/env";
import { logSafe } from "@/lib/scrub";
import { listRecentAdRows, readSync } from "@/lib/paidads/store";
import { syncMetaIfStale } from "@/lib/paidads/sync";
import { buildPaidView } from "@/lib/paidads/view";
import { listOrders } from "@/lib/retention/store";
import { syncShopifyIfStale } from "@/lib/retention/sync";

export async function loadPaid(range: "7d" | "28d") {
  try {
    await Promise.all([
      syncMetaIfStale().catch((error) => logSafe("meta sync", error)),
      syncShopifyIfStale().catch((error) => logSafe("shopify sync", error)),
    ]);
    const [rows, orders, sync] = await Promise.all([listRecentAdRows(), listOrders(), readSync("paidads-meta")]);
    const view = buildPaidView({
      rows,
      orders: orders.map((order) => ({
        customerId: order.customerId,
        orderedOn: order.orderedOn,
        totalPence: order.totalPence,
        currency: order.currency,
      })),
      today: londonToday(),
      range,
      metaConnected: metaMissing().length === 0,
      googleRows: rows.filter((row) => row.platform === "google").length,
    });
    return { ok: true as const, view, sync };
  } catch (error) {
    logSafe("paid", error);
    return { ok: false as const };
  }
}
