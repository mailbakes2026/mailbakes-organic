"use client";

import { useState } from "react";
import { keyKind, platformLabel } from "@/lib/constants";
import type { KeyDateDTO, NoteDTO } from "@/lib/types";

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function NotesDates({
  notes,
  keyDates,
  onEditNote,
  onOpenKey,
  onChanged,
}: {
  notes: NoteDTO[];
  keyDates: KeyDateDTO[];
  onEditNote: (note: NoteDTO) => void;
  onOpenKey: (item: KeyDateDTO) => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ordered = [...notes].sort(
    (a, b) =>
      Number(a.checked) - Number(b.checked) ||
      (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
      a.title.localeCompare(b.title),
  );
  const dates = [...keyDates].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  async function toggle(note: NoteDTO) {
    setBusyId(note.id);
    setError(null);
    const response = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: !note.checked }),
    });
    setBusyId(null);
    if (!response.ok) {
      setError("Couldn't update that note.");
      return;
    }
    onChanged();
  }

  return (
    <div className="stack notes-dates">
      {error ? <p className="alert crit">{error}</p> : null}
      <section className="card notes-list">
        <h2>Notes</h2>
        <p className="muted">Tick a note when it’s done. Dates stay here, not on the calendar.</p>
        {ordered.length === 0 ? <p className="empty">No notes yet.</p> : null}
        <ul className="check-list">
          {ordered.map((note) => (
            <li key={note.id} className={note.checked ? "done" : ""}>
              <label>
                <input
                  type="checkbox"
                  checked={note.checked}
                  disabled={busyId === note.id}
                  onChange={() => void toggle(note)}
                />
                <span>
                  <b>{note.title}</b>
                  <span className="small muted">
                    {note.date ? formatDay(note.date) : "No date"}
                    {note.allPlatforms ? " · All platforms" : note.platform ? ` · ${platformLabel(note.platform)}` : ""}
                    {note.doThisWeek ? " · Do this week" : ""}
                  </span>
                </span>
              </label>
              <button type="button" className="btn ghost sm" onClick={() => onEditNote(note)}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="card notes-list">
        <h2>Key dates</h2>
        <p className="muted">Launches and other dates. They still show as markers on the content calendar.</p>
        {dates.length === 0 ? <p className="empty">No key dates yet.</p> : null}
        <ul className="check-list key-list">
          {dates.map((item) => (
            <li key={item.id}>
              <button type="button" className="key-open" onClick={() => onOpenKey(item)}>
                <span className={keyKind(item.kind).pill}>
                  {keyKind(item.kind).label}
                </span>
                <span>
                  <b>{item.title}</b>
                  <span className="small muted">{formatDay(item.date)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
