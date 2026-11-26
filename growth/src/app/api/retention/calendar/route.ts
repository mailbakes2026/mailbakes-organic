import { londonToday } from "@/lib/dates";
import { klaviyoMissing, retentionToken } from "@/lib/env";
import { json } from "@/lib/http";
import { calendarAction } from "@/lib/retention/calendar/http";
import { calendarRange } from "@/lib/retention/calendar/model";
import { loadCalendar } from "@/lib/retention/calendar/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return calendarAction(request, async () => {
    const url = new URL(request.url);
    const range = calendarRange({
      week: url.searchParams.get("week"),
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    if (!range.ok) return json({ error: range.error }, 400);
    const week = await loadCalendar(range.from, range.to, {
      today: londonToday(),
      klaviyoConnected: klaviyoMissing().length === 0,
      tokenConfigured: retentionToken() !== null,
    });
    return json(week);
  });
}
