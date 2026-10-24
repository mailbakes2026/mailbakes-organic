"use client";

import { useMemo, useState } from "react";
import { channelsFor, statusLabel } from "@/lib/constants";
import type { KeyDateDTO, NoteDTO, PostDTO, StatusId } from "@/lib/types";

function londonToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDays(iso, diff);
}

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatMonth(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function monthCells(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const monthKey = first.slice(0, 7);
  while (cells.length > 7 && cells.slice(-7).every((day) => day.slice(0, 7) !== monthKey)) {
    cells.splice(-7, 7);
  }
  return cells;
}

function monthBounds(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

function chipClass(status: StatusId) {
  if (status === "APPROVED") return "approved";
  if (status === "CHANGES_REQUESTED") return "changes";
  if (status === "AMENDMENTS_MADE") return "amended";
  if (status === "DRAFT") return "draft";
  return "pending";
}

export function CalendarBoard({
  posts,
  notes,
  keyDates,
  cursor,
  view,
  onCursor,
  onView,
  onOpenPost,
  onOpenKey,
  onCreatePost,
  onEditNote,
  onChanged,
}: {
  posts: PostDTO[];
  notes: NoteDTO[];
  keyDates: KeyDateDTO[];
  cursor: string;
  view: "month" | "week";
  onCursor: (iso: string) => void;
  onView: (view: "month" | "week") => void;
  onOpenPost: (post: PostDTO) => void;
  onOpenKey: (item: KeyDateDTO) => void;
  onCreatePost: (date: string) => void;
  onEditNote: (note: NoteDTO) => void;
  onChanged: () => void;
}) {
  const today = londonToday();
  const [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      return { start, end: addDays(start, 6), days: Array.from({ length: 7 }, (_, index) => addDays(start, index)) };
    }
    const bounds = monthBounds(cursor);
    return { ...bounds, days: monthCells(cursor) };
  }, [cursor, view]);

  function shift(direction: number) {
    if (view === "week") onCursor(addDays(cursor, direction * 7));
    else {
      const [year, month] = cursor.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1 + direction, 1));
      onCursor(date.toISOString().slice(0, 10));
    }
  }

  const dayNotes = notes
    .filter((note) => note.date === selected)
    .sort((a, b) => Number(a.checked) - Number(b.checked) || a.title.localeCompare(b.title));
  const loose = notes
    .filter((note) => !note.date)
    .sort((a, b) => Number(a.checked) - Number(b.checked) || a.title.localeCompare(b.title));

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("title", title);
    body.set("description", "");
    body.set("links", "[]");
    body.set("platform", "");
    body.set("date", selected);
    body.set("doThisWeek", "false");
    body.set("status", "IDEA");
    body.set("checked", "false");
    const response = await fetch("/api/notes", { method: "POST", body });
    setBusy(false);
    if (!response.ok) {
      setError("Couldn't add that note.");
      return;
    }
    setDraft("");
    onChanged();
  }

  async function patch(id: string, change: { checked?: boolean; date?: string | null }) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Couldn't update that note.");
      return;
    }
    onChanged();
  }

  return (
    <div className="stack plan-cal">
      <div className="page-head">
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => shift(-1)} aria-label="Previous">
            ‹
          </button>
          <button type="button" className="btn ghost" onClick={() => onCursor(today)}>
            Today
          </button>
          <button type="button" className="btn ghost" onClick={() => shift(1)} aria-label="Next">
            ›
          </button>
          <h2>{view === "month" ? formatMonth(cursor) : `${formatDay(range.start)} – ${formatDay(range.end)}`}</h2>
        </div>
        <div className="view-toggle">
          <button type="button" className={view === "week" ? "on" : ""} onClick={() => onView("week")}>
            Week
          </button>
          <button type="button" className={view === "month" ? "on" : ""} onClick={() => onView("month")}>
            Month
          </button>
        </div>
      </div>

      <div className="legend">
        <span><i className="swatch pending" /> For approval</span>
        <span><i className="swatch changes" /> Needs changes</span>
        <span><i className="swatch amended" /> Amendments made</span>
        <span><i className="swatch approved" /> Approved</span>
        <span><i className="swatch draft" /> Draft</span>
        <span>Colour bar is the channel</span>
      </div>

      <div className="cal-board">
        <div className="cal-head">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="cal-dow">
              {day}
            </div>
          ))}
        </div>
        <div className={`cal plan-grid${view === "week" ? " plan-week" : ""}`}>
          {range.days.map((day) => {
            const outside = view === "month" && day.slice(0, 7) !== range.start.slice(0, 7);
            const dayPosts = posts
              .filter((post) => post.plannedDate === day && post.status !== "REJECTED")
              .sort(
                (a, b) =>
                  (a.plannedTime ?? "99:99").localeCompare(b.plannedTime ?? "99:99") ||
                  a.title.localeCompare(b.title),
              );
            const count = notes.filter((note) => note.date === day && !note.checked).length;
            return (
              <div
                key={day}
                className={`cal-cell plan-day${day === today ? " today" : ""}${day === selected ? " selected" : ""}${outside ? " closed" : ""}`}
              >
                <div className="plan-day-head">
                  <button type="button" className="cal-date" onClick={() => setSelected(day)}>
                    <span>{Number(day.slice(8))}</span>
                    {count > 0 ? <span className="plan-note-count">{count}</span> : null}
                  </button>
                  <button type="button" className="plan-add" aria-label={`New post on ${formatDay(day)}`} onClick={() => onCreatePost(day)}>
                    +
                  </button>
                </div>
                {keyDates
                  .filter((item) => item.date === day)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`cal-chip ${item.kind === "LAUNCH" ? "launch" : "keydate"}`}
                      onClick={() => onOpenKey(item)}
                    >
                      <span className="grow">{item.title}</span>
                    </button>
                  ))}
                {dayPosts.map((post) => {
                  const channels = channelsFor(post.platforms);
                  const colour = channels[0]?.colour ?? "#1E1A1C";
                  return (
                    <button
                      key={post.id}
                      type="button"
                      className={`plan-chip ${chipClass(post.status)}`}
                      style={{ ["--ch" as string]: colour }}
                      onClick={() => onOpenPost(post)}
                    >
                      <span className="plan-chip-meta">
                        {post.plannedTime ? <span className="cal-time">{post.plannedTime}</span> : null}
                        <span className="plan-channels">
                          {channels.map((channel) => (
                            <span key={channel.id} className="cal-tag" style={{ background: channel.colour, color: channel.ink }}>
                              {channel.short}
                            </span>
                          ))}
                        </span>
                      </span>
                      <span className="grow">
                        {post.contentType === "STORY" ? "Story · " : ""}
                        {post.title}
                      </span>
                      <span className="plan-status">{statusLabel(post.status)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <section className="day-notes" aria-label="Notes">
        <div className="page-head">
          <div>
            <h2>Notes · {formatDay(selected)}</h2>
            <p className="muted">Tick items off. Notes stay on the day you attach them to.</p>
          </div>
        </div>
        {error ? <p className="alert crit">{error}</p> : null}
        <form className="row note-add" onSubmit={(event) => void addNote(event)}>
          <input
            aria-label="New note"
            placeholder="Add a note for this day"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="btn" disabled={busy || !draft.trim()}>
            Add
          </button>
        </form>
        {dayNotes.length === 0 ? <p className="muted">Nothing on this day yet.</p> : null}
        <ul className="check-list">
          {dayNotes.map((note) => (
            <NoteRow key={note.id} note={note} busy={busy} onToggle={(checked) => void patch(note.id, { checked })} onEdit={() => onEditNote(note)} onDetach={() => void patch(note.id, { date: null })} />
          ))}
        </ul>
        {loose.length > 0 ? (
          <div className="loose-notes">
            <h3>Not on a day yet</h3>
            <ul className="check-list">
              {loose.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  busy={busy}
                  onToggle={(checked) => void patch(note.id, { checked })}
                  onEdit={() => onEditNote(note)}
                  onAttach={() => void patch(note.id, { date: selected })}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function NoteRow({
  note,
  busy,
  onToggle,
  onEdit,
  onAttach,
  onDetach,
}: {
  note: NoteDTO;
  busy: boolean;
  onToggle: (checked: boolean) => void;
  onEdit: () => void;
  onAttach?: () => void;
  onDetach?: () => void;
}) {
  return (
    <li className={note.checked ? "is-done" : ""}>
      <label>
        <input type="checkbox" checked={note.checked} disabled={busy} onChange={(event) => onToggle(event.target.checked)} />
        <span>{note.title}</span>
      </label>
      <span className="small muted">{note.authorName}</span>
      <button type="button" className="subtle" onClick={onEdit}>
        Edit
      </button>
      {onAttach ? (
        <button type="button" className="subtle" disabled={busy} onClick={onAttach}>
          Put on this day
        </button>
      ) : null}
      {onDetach ? (
        <button type="button" className="subtle" disabled={busy} onClick={onDetach}>
          Remove from day
        </button>
      ) : null}
    </li>
  );
}
