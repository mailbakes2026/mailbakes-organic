import { CalendarBoard } from "@/components/calendar-board";
import { CalendarHandoff } from "@/components/calendar-handoff";
import { getSessionUser } from "@/lib/auth";
import { formatMonthLong, londonToday, monthGrid, monthKey } from "@/lib/dates";
import { klaviyoMissing, retentionToken } from "@/lib/env";
import { calendarRange } from "@/lib/retention/calendar/model";
import { loadCalendar } from "@/lib/retention/calendar/store";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; month?: string; view?: string; campaign?: string }>;
}) {
  const query = await searchParams;
  const today = londonToday();
  const monthMode = query.view === "month" || (query.view !== "week" && !query.week);
  try {
    const user = await getSessionUser();
    const meta = {
      today,
      klaviyoConnected: klaviyoMissing().length === 0,
      tokenConfigured: retentionToken() !== null,
    };
    if (!monthMode) {
      const requested = calendarRange({ week: query.week ?? null, from: null, to: null });
      const range = requested.ok ? requested : calendarRange({});
      if (!range.ok) return <p className="alert warn">That week is not a date.</p>;
      const week = await loadCalendar(range.from, range.to, meta);
      return (
        <div className="cal">
          {requested.ok ? null : <p className="alert warn">{requested.error}</p>}
          <CalendarBoard
            key={`${week.from}:${query.campaign ?? ""}`}
            initial={week}
            actor={user?.name ?? "Millie"}
            initialCampaign={query.campaign}
            view="week"
            month={monthKey(range.from)}
            monthLabel={formatMonthLong(monthKey(range.from))}
          />
          <CalendarHandoff tokenConfigured={week.tokenConfigured} />
        </div>
      );
    }
    const requestedMonth = query.month?.trim() || monthKey(today);
    const parsed = monthGrid(requestedMonth);
    const grid = parsed ?? monthGrid(monthKey(today));
    if (!grid) return <p className="alert warn">That month is not a date.</p>;
    const week = await loadCalendar(grid.from, grid.to, meta);
    return (
      <div className="cal">
        {parsed ? null : <p className="alert warn">That month is not a date. Showing this month.</p>}
        <CalendarBoard
          key={`${grid.month}:${query.campaign ?? ""}`}
          initial={week}
          actor={user?.name ?? "Millie"}
          initialCampaign={query.campaign}
          view="month"
          month={grid.month}
          monthLabel={formatMonthLong(grid.month)}
        />
        <CalendarHandoff tokenConfigured={week.tokenConfigured} />
      </div>
    );
  } catch (error) {
    logSafe("calendar", error);
    return <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p>;
  }
}
