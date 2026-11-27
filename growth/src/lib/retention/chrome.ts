import { klaviyoMissing } from "@/lib/env";
import { countNeedsOk } from "@/lib/retention/calendar/store";
import { logSafe } from "@/lib/scrub";

let badge: { at: number; needsOk: number } | null = null;

export async function retentionChrome() {
  const connected = klaviyoMissing().length === 0;
  const now = Date.now();
  if (badge && now - badge.at < 15_000) return { connected, needsOk: badge.needsOk };
  let needsOk = 0;
  try {
    needsOk = await countNeedsOk();
  } catch (error) {
    logSafe("retention nav", error);
  }
  badge = { at: now, needsOk };
  return { connected, needsOk };
}
