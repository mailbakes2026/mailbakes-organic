"use client";

import { useState } from "react";

type Note = { id: string; author: string; body: string; when: string };

export function NoteBoard({
  title,
  hint,
  action,
  authors,
  notes,
}: {
  title: string;
  hint: string;
  action: string;
  authors: string[];
  notes: Note[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    const response = await fetch(action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: data.get("author"), body: data.get("body") }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error || "That note was not saved.");
      return;
    }
    form.reset();
    window.location.reload();
  }

  async function remove(id: string) {
    setError(null);
    const response = await fetch(action, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, confirm: true }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "That note was not removed.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="split">
      <section className="card">
        <h2>{title}</h2>
        {notes.length === 0 ? <p className="empty-state">No notes yet.</p> : null}
        <div className="stack">
          {notes.map((note) => (
            <article key={note.id} className="note">
              <header>
                <b>{note.author}</b>
                <span className="muted small">{note.when}</span>
              </header>
              <p>{note.body}</p>
              {confirmId === note.id ? (
                <div className="row">
                  <span className="muted small">Remove this note?</span>
                  <button className="btn sm danger" type="button" onClick={() => remove(note.id)}>
                    Remove
                  </button>
                  <button className="btn sm ghost" type="button" onClick={() => setConfirmId(null)}>
                    Keep
                  </button>
                </div>
              ) : (
                <button className="subtle small" type="button" onClick={() => setConfirmId(note.id)}>
                  Remove
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
      <form className="card" onSubmit={onSubmit}>
        <h2>Add a note</h2>
        <p className="muted">{hint}</p>
        <label className="field">
          Who
          <select name="author" defaultValue={authors[0]}>
            {authors.map((author) => (
              <option key={author}>{author}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Note
          <textarea name="body" required rows={5} maxLength={4000} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save note"}
        </button>
      </form>
    </div>
  );
}
