"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConnectionCardDTO } from "@/lib/types";

function statusLabel(status: ConnectionCardDTO["status"]) {
  if (status === "CONNECTED") return "Connected";
  if (status === "NEEDS_RECONNECT") return "Needs reconnecting";
  if (status === "SETUP_NEEDED") return "Setup needed";
  return "Not connected";
}

function statusClass(status: ConnectionCardDTO["status"]) {
  if (status === "CONNECTED") return "pill ok";
  if (status === "NEEDS_RECONNECT") return "pill hot";
  if (status === "SETUP_NEEDED") return "pill warn";
  return "pill";
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

export function Connections({
  cards,
  canManage,
  notice,
}: {
  cards: ConnectionCardDTO[];
  canManage: boolean;
  notice: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(notice);
  const [error, setError] = useState<string | null>(null);
  const reconnecting = cards.filter((card) => card.status === "NEEDS_RECONNECT");

  async function syncNow() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/connections/sync", { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      results?: { ok: boolean; message: string }[];
    };
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Couldn't sync.");
      return;
    }
    const failed = (data.results ?? []).filter((item) => !item.ok);
    setMessage(failed.length === 0 ? "Sync finished." : failed.map((item) => item.message).join(" "));
    router.refresh();
  }

  async function disconnect(slug: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/connections/${slug}/disconnect`, { method: "POST" });
    setBusy(false);
    if (!response.ok) {
      setError("Couldn't disconnect that account.");
      return;
    }
    setMessage("Disconnected. Older stats stay in Reports.");
    router.refresh();
  }

  return (
    <div className="stack connections-page">
      <div className="page-head">
        <div>
          <h2>Connections</h2>
          <p className="muted">
            Connect each account once. The app pulls organic posts, views, likes, comments, shares and follows every
            day for Reports. Paid ads are left where they already are.
          </p>
        </div>
        {canManage ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void syncNow()}>
            {busy ? "Syncing…" : "Sync now"}
          </button>
        ) : null}
      </div>
      {reconnecting.length > 0 ? (
        <p className="alert crit">
          {reconnecting.map((card) => card.label).join(", ")} need{reconnecting.length === 1 ? "s" : ""} reconnecting
          before stats can update.
        </p>
      ) : null}
      {message ? <p className="alert ok">{message}</p> : null}
      {error ? <p className="alert crit">{error}</p> : null}
      {!cards.some((card) => card.storageReady) ? (
        <p className="alert crit">
          The server has no key long enough to encrypt tokens. Set TOKEN_ENCRYPTION_KEY (or SESSION_SECRET) to at least
          32 characters.
        </p>
      ) : null}
      <div className="connection-grid">
        {cards.map((card) => (
          <article key={card.id} className={`card connection-card ${card.status === "NEEDS_RECONNECT" ? "needs-reconnect" : ""}`}>
            <div className="row">
              <h3>{card.label}</h3>
              <span className={statusClass(card.status)}>{statusLabel(card.status)}</span>
            </div>
            <p className="muted">{card.blurb}</p>
            {card.accountName ? <p><b>{card.accountName}</b></p> : null}
            <p className="small muted">
              {card.lastSyncedAt ? `Last synced ${formatWhen(card.lastSyncedAt)}` : "Not synced yet"}
            </p>
            {card.lastSyncError ? <p className="error">{card.lastSyncError}</p> : null}
            {card.status === "SETUP_NEEDED" ? (
              <div className="small">
                <p>Setup needed before Connect will work.</p>
                <ul>
                  {card.setup.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                {card.missing.length > 0 ? <p>Missing on the server: {card.missing.join(", ")}</p> : null}
                <p>
                  Redirect URL <code>{card.redirectUri}</code>
                </p>
              </div>
            ) : null}
            {canManage ? (
              <div className="row">
                {card.status === "SETUP_NEEDED" ? (
                  <button type="button" className="btn" disabled>
                    Connect
                  </button>
                ) : (
                  <a className="btn" href={`/api/connections/${card.slug}/start`}>
                    {card.status === "CONNECTED" ? "Reconnect" : card.status === "NEEDS_RECONNECT" ? "Reconnect" : "Connect"}
                  </a>
                )}
                {card.status === "CONNECTED" || card.status === "NEEDS_RECONNECT" ? (
                  <button type="button" className="btn ghost" disabled={busy} onClick={() => void disconnect(card.slug)}>
                    Disconnect
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="small muted">Management connects these accounts.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
