import { isTimeout, KLAVIYO_TIMEOUT } from "@/lib/deadline";
import { json } from "@/lib/http";
import { calendarAction } from "@/lib/retention/calendar/http";
import { calendarRange, readSync } from "@/lib/retention/calendar/model";
import { syncCalendarResults } from "@/lib/retention/calendar/sync";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return calendarAction(request, async () => {
    const text = await request.text();
    let value: unknown = {};
    if (text.trim()) {
      if (text.length > 4_000) return json({ error: "That request is too large." }, 413);
      try {
        value = JSON.parse(text) as unknown;
      } catch {
        return json({ error: "That wasn't valid JSON." }, 400);
      }
    }
    const parsed = readSync(value);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const range = parsed.data.campaignId
      ? null
      : calendarRange({ week: parsed.data.week ?? null, from: parsed.data.from ?? null, to: parsed.data.to ?? null });
    if (range && !range.ok) return json({ error: range.error }, 400);
    try {
      const result = await syncCalendarResults(parsed.data.campaignId ? { campaignId: parsed.data.campaignId } : { from: range && range.ok ? range.from : "", to: range && range.ok ? range.to : "" });
      if (!result.ok) return json({ error: result.error }, result.status);
      return json(result);
    } catch (error) {
      logSafe("calendar sync", error);
      const message = isTimeout(error) ? KLAVIYO_TIMEOUT : error instanceof Error && error.message ? error.message : "Klaviyo did not return campaign results.";
      return json({ error: message }, 502);
    }
  });
}
