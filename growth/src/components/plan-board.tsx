"use client";

import { useState } from "react";

type Item = {
  id: string;
  title: string;
  detail: string;
  decision: string;
  status: string;
  updatedBy: string;
  when: string;
};

export function PlanBoard({ items }: { items: Item[] }) {
  return (
    <div className="stack">
      {items.map((item) => (
        <PlanItem key={item.id} item={item} />
      ))}
    </div>
  );
}

function PlanItem({ item }: { item: Item }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [armed, setArmed] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!armed) {
      setArmed(true);
      return;
    }
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const response = await fetch("/api/retention/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        id: item.id,
        detail: form.get("detail"),
        decision: form.get("decision"),
        author: form.get("author"),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "That line was not saved.");
      return;
    }
    window.location.reload();
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="subhead">
        <h2>{item.title}</h2>
        <span className={`pill ${item.status === "decided" ? "ok" : ""}`}>{item.status === "decided" ? "Decided" : "No decision yet"}</span>
      </div>
      <label className="field">
        Detail
        <textarea name="detail" rows={2} maxLength={2000} defaultValue={item.detail} placeholder="What this line covers" />
      </label>
      <label className="field">
        Decision
        <textarea name="decision" rows={3} maxLength={2000} defaultValue={item.decision} placeholder="Leave blank until there is a decision" />
      </label>
      <label className="field">
        Recorded by
        <select name="author" defaultValue={item.updatedBy || "Kyle"}>
          <option>Kyle</option>
          <option>Millie</option>
        </select>
      </label>
      {item.when ? <p className="muted small">Updated {item.when}{item.updatedBy ? ` · ${item.updatedBy}` : ""}</p> : null}
      {armed ? <p className="warn-copy">This saves the decision on the Q4 plan.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : armed ? "Save decision" : "Record decision"}
      </button>
    </form>
  );
}
