"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { APPOINTMENT_TYPES, type AppointmentTypeLabel, type ReminderLabel } from "@/lib/appointment-rules";
import type { AppointmentDto } from "@/lib/appointments";
import type { GoogleWeekItem } from "@/lib/calendar";

const TYPE_COLOURS: Record<AppointmentTypeLabel, string> = {
  Hair: "#ED217A",
  Aesthetics: "#8B5CF6",
  Work: "#2563EB",
  Meeting: "#0D9488",
  Meal: "#D97706",
  Party: "#65A30D",
  Dinner: "#B91C1C",
  Travel: "#334155",
  Other: "#9CA3AF",
};
const GOOGLE_COLOUR = "#64748B";
const HOUR_PX = 48;
const FIRST_VISIBLE_HOUR = 7;

const REMINDER_LABELS: Record<ReminderLabel, string> = {
  none: "No reminder",
  morning: "Morning of (7am email)",
  "day-before": "Day before (6pm email)",
  both: "Both",
};

type Item = {
  key: string;
  source: "app" | "google";
  title: string;
  colour: string;
  allDay: boolean;
  startDay: string;
  endDay: string;
  startTime: string;
  endTime: string;
  location: string;
  bell: boolean;
  appointment?: AppointmentDto;
  google?: GoogleWeekItem;
};

type Draft = {
  id?: string;
  title: string;
  type: AppointmentTypeLabel;
  allDay: boolean;
  startDay: string;
  endDay: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  reminder: ReminderLabel;
};

// ---------------------------------------------------------------- date helpers (plain YYYY-MM-DD, no time zones)

function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function formatDay(date: Date) {
  return date.toISOString().slice(0, 10);
}
function plusDays(day: string, n: number) {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + n);
  return formatDay(date);
}
function daysApart(from: string, to: string) {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}
function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function clock(total: number) {
  const capped = Math.max(0, Math.min(total, 23 * 60 + 59));
  return `${String(Math.floor(capped / 60)).padStart(2, "0")}:${String(capped % 60).padStart(2, "0")}`;
}
function tint(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
function dayLabel(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(parseDay(day));
}
function londonNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { day: `${read("year")}-${read("month")}-${read("day")}`, minute: Number(read("hour")) * 60 + Number(read("minute")) };
}

async function send(method: string, url: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "That didn't work. Try again.");
  return data;
}

// ---------------------------------------------------------------- layout

/** Side-by-side columns for timed items that overlap on one day. */
function layoutDay(items: Item[]) {
  const sorted = [...items].sort((a, b) => minutes(a.startTime) - minutes(b.startTime) || minutes(b.endTime) - minutes(a.endTime));
  const placed: { item: Item; column: number; columns: number }[] = [];
  let group: { item: Item; column: number }[] = [];
  let groupEnd = -1;
  let ends: number[] = [];
  const flush = () => {
    const columns = Math.max(1, ends.length);
    for (const entry of group) placed.push({ ...entry, columns });
    group = [];
    ends = [];
  };
  for (const item of sorted) {
    const start = minutes(item.startTime);
    if (group.length && start >= groupEnd) flush();
    let column = ends.findIndex((end) => end <= start);
    if (column < 0) {
      ends.push(0);
      column = ends.length - 1;
    }
    ends[column] = minutes(item.endTime);
    group.push({ item, column });
    groupEnd = Math.max(groupEnd, minutes(item.endTime));
  }
  if (group.length) flush();
  return placed;
}

/** Stack all-day bars into rows so overlapping trips don't sit on top of each other. */
function layoutBars(items: Item[], weekStart: string) {
  const weekEnd = plusDays(weekStart, 6);
  const sorted = [...items].sort(
    (a, b) => a.startDay.localeCompare(b.startDay) || b.endDay.localeCompare(a.endDay) || a.title.localeCompare(b.title),
  );
  const rows: [number, number][][] = [];
  return sorted.map((item) => {
    const first = Math.max(0, daysApart(weekStart, item.startDay));
    const last = Math.min(6, daysApart(weekStart, item.endDay));
    let row = rows.findIndex((taken) => taken.every(([a, b]) => last < a || first > b));
    if (row < 0) {
      rows.push([]);
      row = rows.length - 1;
    }
    rows[row].push([first, last]);
    return { item, first, last, row, carriesIn: item.startDay < weekStart, carriesOut: item.endDay > weekEnd };
  });
}

// ---------------------------------------------------------------- component

export function WeekCalendar({
  weekStart,
  today,
  appointments,
  google,
}: {
  weekStart: string;
  today: string;
  appointments: AppointmentDto[];
  google: GoogleWeekItem[];
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<AppointmentTypeLabel>>(new Set());
  const [showGoogle, setShowGoogle] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<GoogleWeekItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<{ day: string; minute: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => plusDays(weekStart, index)), [weekStart]);

  useEffect(() => {
    setNow(londonNow());
    const timer = setInterval(() => setNow(londonNow()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = FIRST_VISIBLE_HOUR * HOUR_PX;
  }, [weekStart]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeAll();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items: Item[] = useMemo(() => {
    const mine: Item[] = appointments
      .filter((appointment) => !hidden.has(appointment.type))
      .map((appointment) => ({
        key: appointment.id,
        source: "app",
        title: appointment.title,
        colour: TYPE_COLOURS[appointment.type],
        allDay: appointment.allDay,
        startDay: appointment.startDay,
        endDay: appointment.endDay,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        location: appointment.location,
        bell: appointment.reminder !== "none",
        appointment,
      }));
    const theirs: Item[] = showGoogle
      ? google.map((event) => ({
          key: event.id,
          source: "google",
          title: event.title,
          colour: GOOGLE_COLOUR,
          allDay: event.allDay,
          startDay: event.startDay,
          endDay: event.endDay,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          bell: false,
          google: event,
        }))
      : [];
    return [...mine, ...theirs];
  }, [appointments, google, hidden, showGoogle]);

  const bars = layoutBars(items.filter((item) => item.allDay), weekStart);
  const barRows = Math.max(1, ...bars.map((bar) => bar.row + 1));

  function closeAll() {
    setDraft(null);
    setViewing(null);
    setConfirmDelete(false);
    setError(null);
  }

  function goToWeek(day: string) {
    router.push(`/calendar?week=${day}`);
  }

  function openNew(preset: Partial<Draft>) {
    setError(null);
    setConfirmDelete(false);
    setDraft({
      title: "",
      type: "Hair",
      allDay: false,
      startDay: today >= weekStart && today <= days[6] ? today : weekStart,
      endDay: "",
      startTime: "10:00",
      endTime: "11:00",
      location: "",
      notes: "",
      reminder: "none",
      ...preset,
    });
  }

  function openItem(item: Item) {
    setError(null);
    setConfirmDelete(false);
    if (item.google) {
      setViewing(item.google);
      return;
    }
    const a = item.appointment!;
    setDraft({
      id: a.id,
      title: a.title,
      type: a.type,
      allDay: a.allDay,
      startDay: a.startDay,
      endDay: a.allDay && a.endDay !== a.startDay ? a.endDay : "",
      startTime: a.startTime || "10:00",
      endTime: a.endTime || "11:00",
      location: a.location,
      notes: a.notes,
      reminder: a.reminder,
    });
  }

  function onGridClick(day: string, event: React.MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const offset = event.nativeEvent.offsetY;
    const start = Math.floor((offset / HOUR_PX) * 4) * 15;
    openNew({ startDay: day, startTime: clock(start), endTime: clock(start + 60), allDay: false });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const body = {
      title: draft.title,
      type: draft.type,
      allDay: draft.allDay,
      startDay: draft.startDay,
      endDay: draft.allDay ? draft.endDay || draft.startDay : draft.startDay,
      startTime: draft.allDay ? "" : draft.startTime,
      endTime: draft.allDay ? "" : draft.endTime,
      location: draft.location,
      notes: draft.notes,
      reminder: draft.reminder,
    };
    setPending(true);
    setError(null);
    try {
      if (draft.id) await send("PATCH", `/api/board/appointments/${draft.id}`, body);
      else await send("POST", "/api/board/appointments", body);
      const movedTo = draft.startDay < weekStart || draft.startDay > days[6] ? draft.startDay : null;
      closeAll();
      if (movedTo) goToWeek(movedTo);
      else router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!draft?.id) return;
    setPending(true);
    setError(null);
    try {
      await send("DELETE", `/api/board/appointments/${draft.id}`);
      closeAll();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
    } finally {
      setPending(false);
    }
  }

  const sameMonth = weekStart.slice(0, 7) === days[6].slice(0, 7);
  const rangeLabel = `${dayLabel(weekStart, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${dayLabel(days[6], {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
  const update = (patch: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...patch } : current));

  return (
    <div className="wk">
      <div className="wk-toolbar">
        <div className="wk-nav">
          <button type="button" className="btn ghost sm" onClick={() => goToWeek(plusDays(weekStart, -7))} aria-label="Previous week">
            ‹
          </button>
          <button type="button" className="btn ghost sm" onClick={() => goToWeek(today)}>
            Today
          </button>
          <button type="button" className="btn ghost sm" onClick={() => goToWeek(plusDays(weekStart, 7))} aria-label="Next week">
            ›
          </button>
          <b className="wk-range">{rangeLabel}</b>
        </div>
        <div className="wk-nav">
          <label className="wk-toggle">
            <input type="checkbox" checked={showGoogle} onChange={(event) => setShowGoogle(event.target.checked)} /> Show Google
          </label>
          <button type="button" className="btn" onClick={() => openNew({})}>
            + Add appointment
          </button>
        </div>
      </div>

      <div className="wk-legend">
        {APPOINTMENT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`wk-chip${hidden.has(type) ? " off" : ""}`}
            aria-pressed={!hidden.has(type)}
            onClick={() =>
              setHidden((current) => {
                const next = new Set(current);
                if (next.has(type)) next.delete(type);
                else next.add(type);
                return next;
              })
            }
          >
            <span className="wk-dot" style={{ background: TYPE_COLOURS[type] }} />
            {type}
          </button>
        ))}
        {showGoogle ? (
          <span className="wk-chip static">
            <span className="wk-dot wk-google-dot" />
            Google
          </span>
        ) : null}
      </div>

      <div className="wk-frame">
        <div className="wk-inner">
          <div className="wk-row wk-heads">
            <div />
            {days.map((day) => (
              <button
                key={day}
                type="button"
                className={`wk-head${day === today ? " today" : ""}`}
                title="Add an all-day appointment"
                onClick={() => openNew({ startDay: day, allDay: true })}
              >
                <span className="wk-dow">{dayLabel(day, { weekday: "short" })}</span>
                <span className="wk-num">{dayLabel(day, { day: "numeric" })}</span>
              </button>
            ))}
          </div>

          <div className="wk-row wk-allday" style={{ gridTemplateRows: `repeat(${barRows}, auto)` }}>
            <div className="wk-gutter" style={{ gridRow: `1 / span ${barRows}` }}>
              all day
            </div>
            {days.map((day, index) => (
              <div key={day} className="wk-allday-cell" style={{ gridColumn: index + 2, gridRow: `1 / span ${barRows}` }} />
            ))}
            {bars.map(({ item, first, last, row, carriesIn, carriesOut }) => (
              <button
                key={item.key}
                type="button"
                className={`wk-bar${item.source === "google" ? " google" : ""}`}
                style={{
                  gridColumn: `${first + 2} / ${last + 3}`,
                  gridRow: row + 1,
                  background: tint(item.colour, 0.16),
                  borderLeftColor: item.colour,
                }}
                title={item.title}
                onClick={() => openItem(item)}
              >
                {carriesIn ? "‹ " : ""}
                {item.title}
                {item.bell ? " 🔔" : ""}
                {carriesOut ? " ›" : ""}
              </button>
            ))}
          </div>

          <div className="wk-scroll" ref={scroller}>
            <div className="wk-row wk-body" style={{ height: 24 * HOUR_PX }}>
              <div className="wk-hours">
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="wk-hour" style={{ height: HOUR_PX }}>
                    {hour ? <span>{`${hour}:00`}</span> : null}
                  </div>
                ))}
              </div>
              {days.map((day) => {
                const onDay = items.filter((item) => !item.allDay && item.startDay === day);
                return (
                  <div
                    key={day}
                    className={`wk-col${day === today ? " today" : ""}`}
                    style={{ backgroundSize: `100% ${HOUR_PX}px` }}
                    onClick={(event) => onGridClick(day, event)}
                  >
                    {layoutDay(onDay).map(({ item, column, columns }) => {
                      const top = (minutes(item.startTime) / 60) * HOUR_PX;
                      const height = Math.max(22, ((minutes(item.endTime) - minutes(item.startTime)) / 60) * HOUR_PX - 2);
                      const width = 100 / columns;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`wk-event${item.source === "google" ? " google" : ""}`}
                          style={{
                            top,
                            height,
                            left: `calc(${column * width}% + 2px)`,
                            width: `calc(${width}% - 4px)`,
                            background: tint(item.colour, 0.16),
                            borderLeftColor: item.colour,
                          }}
                          onClick={() => openItem(item)}
                        >
                          <b>
                            {item.title}
                            {item.bell ? " 🔔" : ""}
                          </b>
                          <span>
                            {item.startTime}–{item.endTime}
                            {item.location ? ` · ${item.location}` : ""}
                          </span>
                        </button>
                      );
                    })}
                    {now && now.day === day ? <div className="wk-now" style={{ top: (now.minute / 60) * HOUR_PX }} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="muted small">Click an empty slot to add an appointment there, or a date to add an all-day one. Click an appointment to change or delete it.</p>

      {draft ? (
        <div className="wk-overlay" onClick={(event) => event.target === event.currentTarget && closeAll()}>
          <form className="wk-modal" onSubmit={save} aria-label={draft.id ? "Edit appointment" : "Add appointment"}>
            <h2>{draft.id ? "Edit appointment" : "Add appointment"}</h2>
            <label className="field">
              What
              <input required autoFocus value={draft.title} maxLength={200} placeholder="e.g. Hair, Megan" onChange={(event) => update({ title: event.target.value })} />
            </label>
            <div className="wk-two">
              <label className="field">
                Type
                <select value={draft.type} onChange={(event) => update({ type: event.target.value as AppointmentTypeLabel })}>
                  {APPOINTMENT_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Where
                <input value={draft.location} maxLength={300} placeholder="Optional" onChange={(event) => update({ location: event.target.value })} />
              </label>
            </div>
            <label className="wk-check">
              <input type="checkbox" checked={draft.allDay} onChange={(event) => update({ allDay: event.target.checked })} /> All day
            </label>
            <div className={draft.allDay ? "wk-two" : "wk-three"}>
              <label className="field">
                {draft.allDay ? "From" : "Date"}
                <input type="date" required value={draft.startDay} onChange={(event) => update({ startDay: event.target.value })} />
              </label>
              {draft.allDay ? (
                <label className="field">
                  Until (for trips)
                  <input type="date" value={draft.endDay} min={draft.startDay} onChange={(event) => update({ endDay: event.target.value })} />
                </label>
              ) : (
                <>
                  <label className="field">
                    Starts
                    <input type="time" required step={300} value={draft.startTime} onChange={(event) => update({ startTime: event.target.value })} />
                  </label>
                  <label className="field">
                    Ends
                    <input type="time" required step={300} value={draft.endTime} onChange={(event) => update({ endTime: event.target.value })} />
                  </label>
                </>
              )}
            </div>
            <label className="field">
              Email reminder
              <select value={draft.reminder} onChange={(event) => update({ reminder: event.target.value as ReminderLabel })}>
                {(Object.keys(REMINDER_LABELS) as ReminderLabel[]).map((key) => (
                  <option key={key} value={key}>
                    {REMINDER_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Notes
              <textarea value={draft.notes} maxLength={4000} rows={3} placeholder="Optional" onChange={(event) => update({ notes: event.target.value })} />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="wk-actions">
              {draft.id ? (
                confirmDelete ? (
                  <span className="wk-confirm">
                    Delete this?{" "}
                    <button type="button" className="btn sm wk-danger" disabled={pending} onClick={remove}>
                      Yes, delete
                    </button>{" "}
                    <button type="button" className="btn ghost sm" onClick={() => setConfirmDelete(false)}>
                      No
                    </button>
                  </span>
                ) : (
                  <button type="button" className="btn ghost sm" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                )
              ) : (
                <span />
              )}
              <span className="wk-actions-right">
                <button type="button" className="btn ghost" onClick={closeAll}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </button>
              </span>
            </div>
          </form>
        </div>
      ) : null}

      {viewing ? (
        <div className="wk-overlay" onClick={(event) => event.target === event.currentTarget && closeAll()}>
          <div className="wk-modal" role="dialog" aria-label="Google Calendar event">
            <h2>{viewing.title}</h2>
            <p className="muted">
              {viewing.allDay
                ? viewing.endDay === viewing.startDay
                  ? `${dayLabel(viewing.startDay, { weekday: "long", day: "numeric", month: "long" })}, all day`
                  : `${dayLabel(viewing.startDay, { day: "numeric", month: "short" })} to ${dayLabel(viewing.endDay, { day: "numeric", month: "short" })}`
                : `${dayLabel(viewing.startDay, { weekday: "long", day: "numeric", month: "long" })}, ${viewing.startTime}–${viewing.endTime}`}
            </p>
            {viewing.location ? <p>{viewing.location}</p> : null}
            <p className="wk-readonly">From Google Calendar ({viewing.calendar}). Change it in Google.</p>
            <div className="wk-actions">
              {viewing.openUrl ? (
                <a className="btn ghost" href={viewing.openUrl} target="_blank" rel="noreferrer">
                  Open in Google
                </a>
              ) : (
                <span />
              )}
              <button type="button" className="btn" onClick={closeAll}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
