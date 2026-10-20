"use client";

import { useState } from "react";
import { MAX_UPLOAD_BYTES, PLATFORMS, platformLabel } from "@/lib/constants";
import type { NoteDTO, NoteStatusId, PlatformId, PostDTO } from "@/lib/types";

const STATUS_LABEL: Record<NoteStatusId, string> = {
  IDEA: "Idea",
  PLANNED: "Planned",
  DONE: "Done",
};

const COLUMNS: NoteStatusId[] = ["IDEA", "PLANNED", "DONE"];

function statusClass(status: NoteStatusId) {
  if (status === "DONE") return "pill ok";
  if (status === "PLANNED") return "pill warn";
  return "pill";
}

export function NotesBoard({
  notes,
  onEdit,
  onCreate,
  onChanged,
  onDraft,
}: {
  notes: NoteDTO[];
  onEdit: (note: NoteDTO) => void;
  onCreate: () => void;
  onChanged: () => void;
  onDraft: (post: PostDTO) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const thisWeek = notes.filter((note) => note.doThisWeek && !note.date && note.status !== "DONE");

  async function turnIntoPost(note: NoteDTO) {
    setBusyId(note.id);
    setError(null);
    const response = await fetch(`/api/notes/${note.id}/post`, { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as PostDTO & { error?: string };
    setBusyId(null);
    if (!response.ok) {
      setError(data.error || "Couldn't create that draft.");
      return;
    }
    onChanged();
    onDraft(data);
  }

  async function remove(note: NoteDTO) {
    setBusyId(note.id);
    setError(null);
    const response = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!response.ok) {
      setError("Couldn't delete that note.");
      return;
    }
    onChanged();
  }

  return (
    <div className="stack notes-page">
      <div className="page-head">
        <div>
          <h2>Notes</h2>
          <p className="muted">
            Ideas and inspo. A date puts the note on the content calendar. Undated notes ticked “do this week” stay in
            the list below.
          </p>
        </div>
        <button type="button" className="btn" onClick={onCreate}>
          + New note
        </button>
      </div>
      {error ? <p className="alert crit">{error}</p> : null}
      <section className="note-week">
        <h3>This week</h3>
        {thisWeek.length === 0 ? (
          <p className="muted">Nothing flagged for this week. Tick “Do this week” on a note that doesn’t have a date.</p>
        ) : (
          <ul className="note-week-list">
            {thisWeek.map((note) => (
              <li key={note.id}>
                <button type="button" className="note-week-title" onClick={() => onEdit(note)}>
                  <b>{note.title}</b>
                  <span>Do this week</span>
                </button>
                {note.description ? <p className="muted clamp-2">{note.description}</p> : null}
                <div className="row">
                  <button type="button" className="btn sm" disabled={busyId === note.id} onClick={() => void turnIntoPost(note)}>
                    {note.postId ? "Open draft" : "Turn into post"}
                  </button>
                  <button type="button" className="btn ghost sm" onClick={() => onEdit(note)}>
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="note-columns">
        {COLUMNS.map((status) => {
          const items = notes.filter((note) => note.status === status);
          return (
            <section key={status} className="note-column">
              <h3>
                {STATUS_LABEL[status]} <span className="pill">{items.length}</span>
              </h3>
              {items.length === 0 ? <p className="muted small">Nothing here.</p> : null}
              {items.map((note) => (
                <article key={note.id} className="card note-card">
                  <button type="button" className="note-open" onClick={() => onEdit(note)}>
                    {note.images[0] ? (
                      <img src={`/api/note-media/${note.images[0].id}`} alt="" />
                    ) : null}
                    <span className="row">
                      <span className={statusClass(note.status)}>{STATUS_LABEL[note.status]}</span>
                      {note.doThisWeek ? <span className="pill">Do this week</span> : null}
                      {note.platform ? <span className="pill">{platformLabel(note.platform)}</span> : null}
                    </span>
                    <h2>{note.title}</h2>
                    {note.description ? <p className="muted clamp-2">{note.description}</p> : null}
                    <p className="small muted">
                      {note.authorName}
                      {note.date ? ` · ${note.date}` : ""}
                      {note.links.length > 0 ? ` · ${note.links.length} link${note.links.length === 1 ? "" : "s"}` : ""}
                    </p>
                  </button>
                  <div className="row">
                    <button type="button" className="btn sm" disabled={busyId === note.id} onClick={() => void turnIntoPost(note)}>
                      {note.postId ? "Open draft" : "Turn into post"}
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => onEdit(note)}>
                      Edit
                    </button>
                    <button type="button" className="btn danger sm" disabled={busyId === note.id} onClick={() => void remove(note)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function NoteForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: NoteDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [links, setLinks] = useState(initial?.links.join("\n") ?? "");
  const [platform, setPlatform] = useState<PlatformId | "">(initial?.platform ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [doThisWeek, setDoThisWeek] = useState(initial?.doThisWeek ?? false);
  const [status, setStatus] = useState<NoteStatusId>(initial?.status ?? "IDEA");
  const [files, setFiles] = useState<File[]>([]);
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const kept = (initial?.images.length ?? 0) - removeIds.length + files.length;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const tooBig = files.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} is over 10MB.`);
      return;
    }
    if (kept > 6) {
      setError("You can add up to 6 pictures.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = new FormData();
    body.set("title", title);
    body.set("description", description);
    body.set(
      "links",
      JSON.stringify(
        links
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    );
    body.set("platform", platform);
    body.set("date", date);
    body.set("doThisWeek", doThisWeek ? "true" : "false");
    body.set("status", status);
    body.set("removeImageIds", JSON.stringify(removeIds));
    for (const file of files) body.append("images", file);
    const response = await fetch(initial ? `/api/notes/${initial.id}` : "/api/notes", {
      method: initial ? "PATCH" : "POST",
      body,
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Couldn't save that note.");
      return;
    }
    onSaved();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <label className="field" htmlFor="note-title">
        Title *
        <input id="note-title" required value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field" htmlFor="note-description">
        Description
        <textarea
          id="note-description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="field" htmlFor="note-links">
        Links
        <textarea
          id="note-links"
          rows={3}
          value={links}
          placeholder="One link per line"
          onChange={(event) => setLinks(event.target.value)}
        />
        <p className="small muted">Inspo links. One per line.</p>
      </label>
      <div className="grid">
        <label className="field" htmlFor="note-platform">
          Platform
          <select id="note-platform" value={platform} onChange={(event) => setPlatform(event.target.value as PlatformId | "")}>
            <option value="">No platform</option>
            {PLATFORMS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="note-date">
          Date
          <input id="note-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <p className="small muted">Optional. A date shows this note on the content calendar.</p>
        </label>
      </div>
      <label className="check-line">
        <input type="checkbox" checked={doThisWeek} onChange={(event) => setDoThisWeek(event.target.checked)} />
        Do this week
      </label>
      <p className="small muted">Undated notes with this ticked show in This week.</p>
      <label className="field" htmlFor="note-status">
        Status
        <select id="note-status" value={status} onChange={(event) => setStatus(event.target.value as NoteStatusId)}>
          {COLUMNS.map((item) => (
            <option key={item} value={item}>
              {STATUS_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <span>Pictures</span>
        <p className="small muted">Optional inspo. JPEG, PNG, WEBP or GIF, up to 6, 10MB each.</p>
        {initial?.images.map((image) =>
          removeIds.includes(image.id) ? null : (
            <div key={image.id} className="file-row">
              <img src={`/api/note-media/${image.id}`} alt="" />
              <span className="grow">{image.fileName}</span>
              <button type="button" className="subtle link-serious" onClick={() => setRemoveIds((current) => [...current, image.id])}>
                Remove
              </button>
            </div>
          ),
        )}
        {files.map((file) => (
          <div key={file.name + file.size} className="file-row">
            <span className="grow">{file.name}</span>
            <button type="button" className="subtle link-serious" onClick={() => setFiles((current) => current.filter((item) => item !== file))}>
              Remove
            </button>
          </div>
        ))}
        <label className="file-drop">
          + Add pictures
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(event) => {
              setFiles((current) => [...current, ...Array.from(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
