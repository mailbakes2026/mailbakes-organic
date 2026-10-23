import { addDays, londonToday } from "@/lib/dates";
import { metaMissing } from "@/lib/env";
import { pullMetaInsights } from "@/lib/paidads/meta";
import { upsertAdRows, writeSync } from "@/lib/paidads/store";
import { logSafe, scrub } from "@/lib/scrub";

let pending: Promise<{ ok: true; rows: number } | { ok: false; error: string }> | null = null;

export async function syncMeta(now = new Date()) {
  const missing = metaMissing();
  if (missing.length) {
    return { ok: false as const, error: `Meta is not connected. Set ${missing.join(" and ")}.` };
  }
  const today = londonToday(now);
  const since = addDays(today, -34);
  try {
    const rows = await pullMetaInsights({
      since,
      until: today,
      token: process.env.META_ACCESS_TOKEN!.trim(),
      accountId: process.env.META_AD_ACCOUNT_ID!.trim(),
    });
    await upsertAdRows(rows);
    const detail = `Stored ${rows.length} Meta rows from ${since} to ${today}.`;
    await writeSync("paidads-meta", "ok", detail);
    return { ok: true as const, rows: rows.length };
  } catch (error) {
    logSafe("meta sync", error);
    const message = scrub(error instanceof Error ? error.message : "Meta sync failed.");
    await writeSync("paidads-meta", "error", message).catch((writeError) => logSafe("meta sync state", writeError));
    return { ok: false as const, error: message };
  }
}

export function syncMetaLocked() {
  pending ??= syncMeta().finally(() => {
    pending = null;
  });
  return pending;
}

export async function syncMetaIfStale(now = new Date()) {
  if (metaMissing().length) return null;
  const { readSync } = await import("@/lib/paidads/store");
  const state = await readSync("paidads-meta");
  if (state?.status === "ok" && state.syncedAt && now.getTime() - state.syncedAt.getTime() < 6 * 60 * 60 * 1000) {
    return null;
  }
  return syncMetaLocked();
}
