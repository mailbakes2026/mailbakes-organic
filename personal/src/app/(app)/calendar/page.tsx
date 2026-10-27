import { WeekCalendar } from "@/components/week-calendar";
import { mondayOf } from "@/lib/appointment-rules";
import { listAppointments, type AppointmentDto } from "@/lib/appointments";
import { loadGoogleRange, type GoogleWeekItem } from "@/lib/calendar";
import { addDays, londonToday, parseDateOnly } from "@/lib/dates";
import { googleStatus } from "@/lib/google";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const params = await searchParams;
  const today = londonToday();
  const asked = typeof params.week === "string" && parseDateOnly(params.week) ? params.week : today;
  const weekStart = mondayOf(asked);
  const weekEnd = addDays(weekStart, 6);

  const google = await googleStatus();
  let googleEvents: GoogleWeekItem[] = [];
  let warnings: string[] = [];
  let calendarError = "";
  if (google.connected && google.configured) {
    try {
      const loaded = await loadGoogleRange(weekStart, weekEnd);
      googleEvents = loaded.events;
      warnings = loaded.warnings;
    } catch (error) {
      console.error(error);
      calendarError = error instanceof Error ? error.message : "Google Calendar could not be loaded.";
    }
  }

  let appointments: AppointmentDto[] = [];
  let appointmentsError = "";
  try {
    appointments = await listAppointments({ from: weekStart, to: weekEnd });
  } catch (error) {
    console.error(error);
    appointmentsError = "Your appointments could not be loaded. Try Refresh.";
  }

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <p className="muted">Your appointments and Google Calendar together. Appointments you add here stay in this app and are never written to Google.</p>
        </div>
      </div>
      {appointmentsError ? <p className="alert crit">{appointmentsError}</p> : null}
      {calendarError ? <p className="alert warn">Google: {calendarError}</p> : null}
      {!google.connected ? <p className="alert warn">Google isn&apos;t connected, so only your own appointments are shown.</p> : null}
      {warnings.length > 0 ? <p className="muted small">Could not read: {warnings.join(", ")}.</p> : null}
      <WeekCalendar weekStart={weekStart} today={today} appointments={appointments} google={googleEvents} />
    </div>
  );
}
