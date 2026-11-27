import { CalendarBoard } from "@/components/calendar-board";
import { CalendarHandoff } from "@/components/calendar-handoff";
import { getSessionUser } from "@/lib/auth";
import { londonToday } from "@/lib/dates";
import { klaviyoMissing, retentionToken } from "@/lib/env";
import { calendarRange } from "@/lib/retention/calendar/model";
import { loadCalendar } from "@/lib/retention/calendar/store";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string; campaign?: string }> }) {
  const query = await searchParams;
  const requested = calendarRange({ week: query.week ?? null, from: null, to: null });
  const range = requested.ok ? requested : calendarRange({});
  if (!range.ok) return <p className="alert warn">That week is not a date.</p>;
  try {
    const user = await getSessionUser();
    const week = await loadCalendar(range.from, range.to, {
      today: londonToday(),
      klaviyoConnected: klaviyoMissing().length === 0,
      tokenConfigured: retentionToken() !== null,
    });
    return (
      <div className="cal">
        {requested.ok ? null : <p className="alert warn">{requested.error}</p>}
        <CalendarBoard key={`${week.from}:${query.campaign ?? ""}`} initial={week} actor={user?.name ?? "Millie"} initialCampaign={query.campaign} />
        <CalendarHandoff tokenConfigured={week.tokenConfigured} />
      </div>
    );
  } catch (error) {
    logSafe("calendar", error);
    return <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p>;
  }
}
