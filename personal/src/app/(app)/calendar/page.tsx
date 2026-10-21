import { loadUpcoming, type CalendarItem } from "@/lib/calendar";
import { formatLondonDay, londonToday } from "@/lib/dates";
import { googleStatus } from "@/lib/google";

export const dynamic = "force-dynamic";

function Lane({ title, events }: { title: string; events: CalendarItem[] }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {events.length === 0 ? <p className="muted">Nothing here.</p> : null}
      {events.map((event) => (
        <div key={event.id} className="event">
          <b>{event.title}</b>
          <div className="small muted">
            {event.timeLabel}
            {event.calendar ? ` · ${event.calendar}` : ""}
          </div>
          {event.location ? <div className="small">{event.location}</div> : null}
          <div className="row">
            {event.joinUrl ? (
              <a href={event.joinUrl} target="_blank" rel="noreferrer">
                Join
              </a>
            ) : null}
            {event.openUrl ? (
              <a href={event.openUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function CalendarPage() {
  const google = await googleStatus();
  const today = londonToday();
  let events: CalendarItem[] = [];
  let warnings: string[] = [];
  let calendarError = "";
  if (google.connected && google.configured) {
    try {
      const loaded = await loadUpcoming();
      events = loaded.events;
      warnings = loaded.warnings;
    } catch (error) {
      console.error(error);
      calendarError = error instanceof Error ? error.message : "The calendar could not be loaded.";
    }
  }

  const happening = events.filter((event) => event.happening);
  const upcoming = events.filter((event) => !event.happening);
  const days = [...new Set(upcoming.map((event) => event.day))];

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <p className="muted">What is on now, and the next two weeks. MailBakes and personal are split by the calendar name.</p>
        </div>
        <a className="btn" href="/calendar">
          Refresh
        </a>
      </div>
      {calendarError ? <p className="alert warn">{calendarError}</p> : null}
      {warnings.length > 0 ? (
        <p className="muted small">Could not read: {warnings.join(", ")}.</p>
      ) : null}

      <section>
        <h2>On now</h2>
        {happening.length === 0 ? (
          <p className="muted">Nothing on at the moment.</p>
        ) : (
          <div className="lanes">
            <Lane title="MailBakes" events={happening.filter((event) => event.lane === "mailbakes")} />
            <Lane title="Personal" events={happening.filter((event) => event.lane === "personal")} />
          </div>
        )}
      </section>

      <section>
        <h2>Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="muted">
            {google.connected ? "Nothing else in the next two weeks." : "Connect Google to load the diary."}
          </p>
        ) : (
          days.map((day) => {
            const onDay = upcoming.filter((event) => event.day === day);
            return (
              <div key={day}>
                <h3>{formatLondonDay(day, today)}</h3>
                <div className="lanes">
                  <Lane title="MailBakes" events={onDay.filter((event) => event.lane === "mailbakes")} />
                  <Lane title="Personal" events={onDay.filter((event) => event.lane === "personal")} />
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
