"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

type Change = {
  id: string;
  day: string;
  author: string;
  level: string;
  objectName: string;
  previousPence: number | null;
  nextPence: number;
  currency: string;
  note: string;
  today: boolean;
};

export function ChangeLog({ changes, today }: { changes: Change[]; today: string }) {
  const current = changes.find((change) => change.today) ?? null;
  return (
    <div className="split">
      <section className="card">
        <h2>Log</h2>
        {changes.length === 0 ? (
          <p className="empty-state">No budget changes have been recorded.</p>
        ) : (
          <div className="stack">
            {changes.map((change) => (
              <article key={change.id} className="note">
                <header>
                  <b>
                    {change.day} · {change.objectName}
                  </b>
                  <span className="muted small">{change.author}</span>
                </header>
                <p>
                  {change.level} · {change.previousPence === null ? "Previous budget not recorded" : formatMoney(change.previousPence, change.currency)} →{" "}
                  {formatMoney(change.nextPence, change.currency)}
                </p>
                {change.note ? <p className="muted">{change.note}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
      <ChangeForm today={today} current={current} />
    </div>
  );
}

function ChangeForm({ today, current }: { today: string; current: Change | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [armed, setArmed] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (current && !armed) {
      setArmed(true);
      return;
    }
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const response = await fetch("/api/paidads/changes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        id: current?.id,
        level: form.get("level"),
        objectName: form.get("objectName"),
        previous: form.get("previous"),
        next: form.get("next"),
        currency: form.get("currency"),
        note: form.get("note"),
        author: form.get("author"),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "That change was not saved.");
      return;
    }
    window.location.reload();
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>{current ? "Today's Meta change" : "Record a Meta budget change"}</h2>
      <p className="warn-copy">
        This writes the log only. It does not change the budget in Meta. Meta is limited to one budget change a day ({today}, London).
        {current ? " Saving replaces today's row." : ""}
      </p>
      {current && armed ? <p className="error">Check the figures, then save. This replaces the change already recorded today.</p> : null}
      <label className="field">
        Level
        <select name="level" defaultValue={current?.level ?? "campaign"}>
          <option value="account">Account</option>
          <option value="campaign">Campaign</option>
          <option value="adset">Ad set</option>
        </select>
      </label>
      <label className="field">
        Name
        <input name="objectName" required maxLength={200} defaultValue={current?.objectName ?? ""} />
      </label>
      <div className="figure-row">
        <label className="field">
          Previous
          <input name="previous" inputMode="decimal" defaultValue={current?.previousPence === null || current?.previousPence === undefined ? "" : (current.previousPence / 100).toFixed(2)} placeholder="Optional" />
        </label>
        <label className="field">
          New budget
          <input name="next" inputMode="decimal" required defaultValue={current ? (current.nextPence / 100).toFixed(2) : ""} />
        </label>
        <label className="field">
          Currency
          <input name="currency" required maxLength={3} defaultValue={current?.currency ?? "GBP"} />
        </label>
      </div>
      <label className="field">
        Who
        <select name="author" defaultValue={current?.author ?? "Millie"}>
          <option>Millie</option>
          <option>Mikey</option>
        </select>
      </label>
      <label className="field">
        Note
        <textarea name="note" rows={3} maxLength={1000} defaultValue={current?.note ?? ""} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : current ? (armed ? "Save edit" : "Edit today's change") : "Record budget change"}
      </button>
      <p className="muted small">Google Ads changes are not recorded while that connector is parked.</p>
    </form>
  );
}
