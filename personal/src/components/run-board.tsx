"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type RunCard = {
  id: string;
  title: string;
  status: "waiting" | "needs Millie" | "done";
  notes: string;
  emailUrl: string;
};

const COLUMNS: { status: RunCard["status"]; title: string; empty: string }[] = [
  { status: "waiting", title: "Waiting", empty: "Nothing you are waiting on." },
  { status: "needs Millie", title: "Needs Millie", empty: "Nothing that needs Millie." },
  { status: "done", title: "Done", empty: "Nothing ticked off." },
];

async function send(method: string, url: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "That didn't work. Try again.");
}

export function RunBoard({ items }: { items: RunCard[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function onAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = event.currentTarget;
    await run(async () => {
      await send("POST", "/api/board/items", {
        title: form.get("title"),
        status: form.get("status"),
        notes: form.get("notes"),
        emailUrl: form.get("emailUrl"),
      });
      target.reset();
    });
  }

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Run-through</h1>
          <p className="muted">Open items and follow-ups: a quote you are waiting on, a contract, a refund. Your PA can add these from the assistant API too.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <form className="card" onSubmit={onAdd}>
        <h2>Add an item</h2>
        <label className="field" htmlFor="title">
          What
          <input id="title" name="title" required maxLength={200} placeholder="Waiting on the flour quote" />
        </label>
        <div className="grid">
          <label className="field" htmlFor="status">
            Status
            <select id="status" name="status" defaultValue="waiting">
              <option value="waiting">Waiting</option>
              <option value="needs Millie">Needs Millie</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="field" htmlFor="emailUrl">
            Email link
            <input id="emailUrl" name="emailUrl" type="url" placeholder="https://mail.google.com/..." />
          </label>
        </div>
        <label className="field" htmlFor="notes">
          Notes
          <textarea id="notes" name="notes" rows={3} maxLength={8000} />
        </label>
        <button className="btn" type="submit" disabled={pending}>
          Add
        </button>
      </form>

      <div className="run-cols">
        {COLUMNS.map((column) => {
          const rows = items.filter((item) => item.status === column.status);
          return (
            <section key={column.status} className="card">
              <h2>
                {column.title} <span className="pill">{rows.length}</span>
              </h2>
              {rows.length === 0 ? <p className="muted">{column.empty}</p> : null}
              <div className="stack-list">
                {rows.map((item) => (
                  <article key={item.id} className="mail-card">
                    <b>{item.title}</b>
                    {item.notes ? <p className="muted">{item.notes}</p> : null}
                    {item.emailUrl ? (
                      <a href={item.emailUrl} target="_blank" rel="noreferrer">
                        Open the email
                      </a>
                    ) : null}
                    <div className="row">
                      {COLUMNS.filter((choice) => choice.status !== item.status).map((choice) => (
                        <button
                          key={choice.status}
                          className="btn ghost sm"
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => send("PATCH", `/api/board/items/${item.id}`, { status: choice.status }))}
                        >
                          {choice.title}
                        </button>
                      ))}
                      <button className="subtle" type="button" disabled={pending} onClick={() => run(() => send("DELETE", `/api/board/items/${item.id}`))}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
