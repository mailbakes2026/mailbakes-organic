"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatLondonWhen } from "@/lib/dates";

export type ReminderItem = {
  id: string;
  title: string;
  notes: string;
  dueOn: string;
  done: boolean;
  snoozedUntil: string | null;
};

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

export function RemindersBoard({
  reminders,
  today,
}: {
  reminders: ReminderItem[];
  today: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const now = Date.now();

  const todayItems = reminders.filter((item) => {
    if (item.done) return false;
    if (item.snoozedUntil && Date.parse(item.snoozedUntil) > now) return false;
    return item.dueOn <= today;
  });
  const later = reminders.filter((item) => !item.done && !todayItems.includes(item));
  const done = reminders.filter((item) => item.done);

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
      await send("POST", "/api/board/reminders", {
        title: form.get("title"),
        notes: form.get("notes"),
        dueOn: form.get("dueOn"),
      });
      target.reset();
    });
  }

  function Card({ item, overdue }: { item: ReminderItem; overdue?: boolean }) {
    return (
      <article className={`mail-card${item.done ? "" : ""}`}>
        <div className="mail-line">
          <b>{item.title}</b>
          <span className={`pill${overdue ? " hot" : ""}`}>{overdue ? "Overdue" : item.dueOn}</span>
        </div>
        {item.notes ? <p className="muted">{item.notes}</p> : null}
        {item.snoozedUntil ? <p className="small muted">Snoozed until {formatLondonWhen(item.snoozedUntil)}.</p> : null}
        <div className="row">
          {item.done ? (
            <button className="btn ghost sm" type="button" disabled={pending} onClick={() => run(() => send("PATCH", `/api/board/reminders/${item.id}`, { done: false }).then(() => undefined))}>
              Put back
            </button>
          ) : (
            <button className="btn sm" type="button" disabled={pending} onClick={() => run(() => send("PATCH", `/api/board/reminders/${item.id}`, { done: true }).then(() => undefined))}>
              Tick off
            </button>
          )}
          {!item.done ? (
            <>
              <button className="btn ghost sm" type="button" disabled={pending} onClick={() => run(() => send("PATCH", `/api/board/reminders/${item.id}`, { snooze: "later" }).then(() => undefined))}>
                Later today
              </button>
              <button className="btn ghost sm" type="button" disabled={pending} onClick={() => run(() => send("PATCH", `/api/board/reminders/${item.id}`, { snooze: "tomorrow" }).then(() => undefined))}>
                Tomorrow
              </button>
              <button className="btn ghost sm" type="button" disabled={pending} onClick={() => run(() => send("PATCH", `/api/board/reminders/${item.id}`, { snooze: "week" }).then(() => undefined))}>
                Next week
              </button>
            </>
          ) : null}
          <button className="subtle" type="button" disabled={pending} onClick={() => run(() => send("DELETE", `/api/board/reminders/${item.id}`).then(() => undefined))}>
            Remove
          </button>
        </div>
      </article>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Reminders</h1>
          <p className="muted">Today is {today}, London time. Snooze hides one until later today, tomorrow morning, or next week.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <form className="card" onSubmit={onAdd}>
        <h2>Add a reminder</h2>
        <label className="field" htmlFor="title">
          What
          <input id="title" name="title" required maxLength={200} />
        </label>
        <div className="grid">
          <label className="field" htmlFor="dueOn">
            Due
            <input id="dueOn" name="dueOn" type="date" required defaultValue={today} />
          </label>
          <label className="field" htmlFor="notes">
            Notes
            <input id="notes" name="notes" maxLength={8000} />
          </label>
        </div>
        <button className="btn" type="submit" disabled={pending}>
          Add
        </button>
      </form>

      <section>
        <h2>Today</h2>
        {todayItems.length === 0 ? <p className="muted">Nothing due today.</p> : (
          <div className="stack-list">
            {todayItems.map((item) => (
              <Card key={item.id} item={item} overdue={item.dueOn < today} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Later</h2>
        {later.length === 0 ? <p className="muted">Nothing later.</p> : (
          <div className="stack-list">
            {later.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 ? (
        <details className="fold">
          <summary>Ticked off ({done.length})</summary>
          <div className="stack-list">
            {done.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
