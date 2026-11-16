"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DiaryDay, DiaryItemDto } from "@/lib/diary";
import { SOURCE_LABELS } from "@/lib/diary-rules";

const SOURCE_COLOURS: Record<string, string> = {
  operations: "#0D9488",
  orders: "#2563EB",
  finance: "#334155",
  conversion: "#ED217A",
  organic: "#65A30D",
  other: "#9CA3AF",
};

const TYPE_COLOURS: Record<string, string> = {
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

function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function plusDays(day: string, n: number) {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
function label(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(parseDay(day));
}
function heading(day: string, today: string) {
  if (day === today) return `Today, ${label(day, { weekday: "long", day: "numeric", month: "long" })}`;
  if (day === plusDays(today, 1)) return `Tomorrow, ${label(day, { weekday: "long", day: "numeric", month: "long" })}`;
  if (day === plusDays(today, -1)) return `Yesterday, ${label(day, { weekday: "long", day: "numeric", month: "long" })}`;
  return label(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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

export function DiaryBoard({ diary }: { diary: DiaryDay }) {
  const router = useRouter();
  const { day, today } = diary;
  const [items, setItems] = useState<DiaryItemDto[]>(diary.items);
  const [newItem, setNewItem] = useState("");
  const [note, setNote] = useState(diary.note);
  const [noteState, setNoteState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [reminderText, setReminderText] = useState("");
  const [reminderDay, setReminderDay] = useState(plusDays(day, 1));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedNote = useRef(diary.note);

  useEffect(() => {
    setItems(diary.items);
    setNote(diary.note);
    savedNote.current = diary.note;
    setNoteState("saved");
    setReminderDay(plusDays(diary.day, 1));
  }, [diary]);

  function go(target: string) {
    router.push(target === today ? "/diary" : `/diary?day=${target}`);
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    await run(async () => {
      const data = (await send("POST", "/api/board/diary-items", { day, text })) as { item: DiaryItemDto };
      setItems((current) => [...current, data.item]);
      setNewItem("");
    });
  }

  async function toggle(item: DiaryItemDto) {
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, done: !row.done } : row)));
    await run(async () => {
      await send("PATCH", `/api/board/diary-items/${item.id}`, { done: !item.done });
    });
  }

  async function remove(item: DiaryItemDto) {
    setItems((current) => current.filter((row) => row.id !== item.id));
    await run(async () => {
      await send("DELETE", `/api/board/diary-items/${item.id}`);
    });
  }

  async function saveNote(body: string) {
    if (body === savedNote.current) return setNoteState("saved");
    setNoteState("saving");
    await run(async () => {
      await send("PATCH", `/api/board/diary-notes/${day}`, { body });
      savedNote.current = body;
      setNoteState("saved");
    });
  }

  function onNoteChange(value: string) {
    setNote(value);
    setNoteState("unsaved");
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => saveNote(value), 1200);
  }

  async function addReminder(event: React.FormEvent) {
    event.preventDefault();
    const title = reminderText.trim();
    if (!title) return;
    await run(async () => {
      await send("POST", "/api/board/reminders", { title, dueOn: reminderDay });
      setReminderText("");
      router.refresh();
    });
  }

  async function reminderDone(id: string) {
    await run(async () => {
      await send("PATCH", `/api/board/reminders/${id}`, { done: true });
      router.refresh();
    });
  }

  async function refreshDebriefs() {
    await run(async () => {
      await send("POST", "/api/board/debriefs/pull");
      router.refresh();
    });
  }

  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);

  return (
    <div className="dy">
      <div className="dy-head">
        <div className="dy-nav">
          <button type="button" className="btn ghost sm" onClick={() => go(plusDays(day, -1))} aria-label="Previous day">
            ‹
          </button>
          <button type="button" className="btn ghost sm" onClick={() => go(today)} disabled={day === today}>
            Today
          </button>
          <button type="button" className="btn ghost sm" onClick={() => go(plusDays(day, 1))} aria-label="Next day">
            ›
          </button>
          <input
            type="date"
            className="dy-date"
            value={day}
            aria-label="Go to a date"
            onChange={(event) => event.target.value && go(event.target.value)}
          />
        </div>
        <h1>{heading(day, today)}</h1>
      </div>

      {error ? <p className="alert warn">{error}</p> : null}

      <div className="dy-grid">
        <div className="dy-col">
          <section className="card dy-card">
            <div className="dy-card-head">
              <h2>To do</h2>
              <span className="muted small">
                {done.length}/{items.length} done
              </span>
            </div>
            {items.length === 0 ? <p className="muted small">Nothing yet. Add what you need to get done.</p> : null}
            <ul className="dy-list">
              {[...open, ...done].map((item) => (
                <li key={item.id} className={`dy-item${item.done ? " done" : ""}`}>
                  <label className="dy-tick">
                    <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
                    <span>{item.text}</span>
                  </label>
                  {item.carriedFrom && !item.done ? (
                    <span className="dy-carried" title={`First written ${label(item.carriedFrom, { day: "numeric", month: "short" })}`}>
                      from {label(item.carriedFrom, { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  ) : null}
                  <button type="button" className="dy-x" aria-label={`Delete ${item.text}`} onClick={() => remove(item)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <form className="dy-add" onSubmit={addItem}>
              <input
                value={newItem}
                maxLength={300}
                placeholder="Add a to-do and press Enter"
                aria-label="Add a to-do"
                onChange={(event) => setNewItem(event.target.value)}
              />
              <button type="submit" className="btn sm" disabled={busy || !newItem.trim()}>
                Add
              </button>
            </form>
            {day >= today ? <p className="muted small">Anything not ticked moves to the next day automatically.</p> : null}
          </section>

          <section className="card dy-card">
            <div className="dy-card-head">
              <h2>Reminders</h2>
            </div>
            {diary.reminders.length === 0 ? <p className="muted small">No reminders for this day.</p> : null}
            <ul className="dy-list">
              {diary.reminders.map((reminder) => (
                <li key={reminder.id} className="dy-item">
                  <label className="dy-tick">
                    <input type="checkbox" checked={false} onChange={() => reminderDone(reminder.id)} />
                    <span>
                      {reminder.title}
                      {reminder.notes ? <span className="muted small"> · {reminder.notes}</span> : null}
                    </span>
                  </label>
                  {reminder.overdue ? (
                    <span className="dy-carried hot">due {label(reminder.dueOn, { day: "numeric", month: "short" })}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <form className="dy-add" onSubmit={addReminder}>
              <input
                value={reminderText}
                maxLength={200}
                placeholder="Remind me to…"
                aria-label="Reminder"
                onChange={(event) => setReminderText(event.target.value)}
              />
              <input
                type="date"
                className="dy-date"
                value={reminderDay}
                aria-label="Reminder date"
                onChange={(event) => setReminderDay(event.target.value)}
              />
              <button type="submit" className="btn sm" disabled={busy || !reminderText.trim()}>
                Add
              </button>
            </form>
          </section>

          <section className="card dy-card">
            <div className="dy-card-head">
              <h2>Notes</h2>
              <span className="muted small">{noteState === "saving" ? "Saving…" : noteState === "unsaved" ? "Typing…" : "Saved"}</span>
            </div>
            <textarea
              className="dy-note"
              value={note}
              placeholder="Anything to remember about this day…"
              aria-label="Notes"
              onChange={(event) => onNoteChange(event.target.value)}
              onBlur={() => saveNote(note)}
            />
          </section>
        </div>

        <div className="dy-col">
          <section className="card dy-card">
            <div className="dy-card-head">
              <h2>Appointments</h2>
              <a className="small" href={`/calendar?week=${day}`}>
                Calendar
              </a>
            </div>
            {diary.appointments.length === 0 ? <p className="muted small">Nothing booked.</p> : null}
            <ul className="dy-list">
              {diary.appointments.map((appointment) => (
                <li key={appointment.id} className="dy-appt" style={{ borderLeftColor: TYPE_COLOURS[appointment.type] ?? "#9CA3AF" }}>
                  <b>{appointment.title}</b>
                  <span className="muted small">
                    {appointment.allDay ? "All day" : `${appointment.startTime}–${appointment.endTime}`}
                    {appointment.location ? ` · ${appointment.location}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card dy-card">
            <div className="dy-card-head">
              <h2>Debriefs</h2>
              {day === today ? (
                <button type="button" className="btn ghost sm" onClick={refreshDebriefs} disabled={busy}>
                  Refresh
                </button>
              ) : null}
            </div>
            {diary.debriefs.length === 0 ? (
              <p className="muted small">
                {day > today ? "Debriefs arrive on the day." : "No debriefs for this day yet. They come in from Operations, Daily Orders, Finance, Conversion and Organic."}
              </p>
            ) : null}
            <div className="dy-debriefs">
              {diary.debriefs.map((debrief) => (
                <article key={debrief.id} className="dy-debrief" style={{ borderLeftColor: SOURCE_COLOURS[debrief.source] ?? "#9CA3AF" }}>
                  <div className="dy-debrief-head">
                    <b>{SOURCE_LABELS[debrief.source] ?? debrief.title}</b>
                    {debrief.title && debrief.title !== SOURCE_LABELS[debrief.source] ? <span className="muted small">{debrief.title}</span> : null}
                    <span className="muted small dy-time">
                      {new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(debrief.receivedAt))}
                    </span>
                  </div>
                  <ul>
                    {debrief.lines.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                  {debrief.link ? (
                    <a className="small" href={debrief.link} target="_blank" rel="noreferrer">
                      Open {SOURCE_LABELS[debrief.source] ?? "app"}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
