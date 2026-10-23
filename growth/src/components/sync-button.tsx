"use client";

import { useState } from "react";

export function SyncButton({ href, label }: { href: string; label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    const response = await fetch(href, { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Sync failed.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="row">
      <button className="btn" type="button" onClick={run} disabled={pending}>
        {pending ? "Syncing…" : label}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
