import { londonToday } from "@/lib/dates";
import { metaMissing } from "@/lib/env";
import { logSafe } from "@/lib/scrub";
import { listRecentAdRows, readSync } from "@/lib/paidads/store";
import { buildPaidView } from "@/lib/paidads/view";

export async function loadPaid(range: "7d" | "28d") {
  try {
    const rows = await listRecentAdRows();
    const sync = await readSync("paidads-meta");
    const view = buildPaidView({
      rows,
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
