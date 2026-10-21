"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatLondonDay } from "@/lib/dates";
import { renderMarkdown } from "@/lib/markdown";

export type BriefingItem = {
  id: string;
  date: string;
  title: string;
  body: string;
};

async function send(method: string, url: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "That didn't work. Try again.");
}

export function BriefingsBoard({ briefings, today }: { briefings: BriefingItem[]; today: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = event.currentTarget;
    setPending(true);
    setError(null);
    try {
      await send("POST", "/api/board/briefings", {
        date: form.get("date"),
        title: form.get("title"),
        body: form.get("body"),
      });
      target.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That briefing could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Briefings</h1>
          <p className="muted">Notes your PA posts before you sit down together. Markdown is fine: headings, lists, bold and links.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <form className="card" onSubmit={onAdd}>
        <h2>Add a briefing</h2>
        <div className="grid">
          <label className="field" htmlFor="date">
            Date
            <input id="date" name="date" type="date" required defaultValue={today} />
          </label>
          <label className="field" htmlFor="title">
            Title
            <input id="title" name="title" maxLength={200} placeholder="Monday run-through" />
          </label>
        </div>
        <label className="field" htmlFor="body">
          Notes
          <textarea id="body" name="body" rows={6} required maxLength={20000} placeholder={"## Waiting on\n- Flour quote from the mill"} />
        </label>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Post briefing"}
        </button>
      </form>

      {briefings.length === 0 ? (
        <section className="card">
          <h2>No briefings yet</h2>
          <p className="muted">Post one here, or your PA can post one with the assistant API.</p>
        </section>
      ) : (
        briefings.map((briefing) => (
          <article key={briefing.id} className="card">
            <p className="eyebrow briefing-date">{formatLondonDay(briefing.date, today)}</p>
            {briefing.title ? <h2>{briefing.title}</h2> : null}
            <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(briefing.body) }} />
          </article>
        ))
      )}
    </div>
  );
}
