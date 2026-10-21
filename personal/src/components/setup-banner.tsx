"use client";

import { useState } from "react";
import { googleEmailMismatch, type GoogleStatus } from "@/lib/google-status";

export function SetupBanner({ google }: { google: GoogleStatus }) {
  const mismatch = googleEmailMismatch(google);
  const ready =
    google.configured &&
    google.encryptionReady &&
    google.connected &&
    google.driveGranted &&
    !google.lastError &&
    !mismatch &&
    google.apiReady;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (ready) return null;

  async function disconnect() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/google/disconnect", { method: "POST" });
    setPending(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Google could not be disconnected.");
      return;
    }
    window.location.href = "/inbox";
  }

  const missing: string[] = [];
  if (!google.configured) missing.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  if (!google.encryptionReady) missing.push("TOKEN_ENCRYPTION_KEY (or a SESSION_SECRET of at least 32 characters)");
  if (!google.apiReady) missing.push("PERSONAL_API_TOKEN (at least 16 characters)");

  return (
    <div className="alert warn" role="status">
      <div className="setup-copy">
        <b>Setup needed</b>
        {missing.length > 0 ? (
          <p>
            Add {missing.join(", ")} on Render, then redeploy. Archive and Send to finance stay off until you press
            those buttons.
          </p>
        ) : null}
        {google.configured && google.encryptionReady && !google.connected ? (
          <p>Connect {google.expectedEmail} so the inbox and calendar can load.</p>
        ) : null}
        {google.lastError ? <p>{google.lastError}</p> : null}
        {mismatch ? (
          <p>
            Connected as {google.email}. The inbox this is for is {google.expectedEmail}. Disconnect and connect that
            account if this is the wrong one.
          </p>
        ) : null}
        {google.connected && !google.driveGranted ? (
          <p>Connect Google again so payslips can be filed in the staff Drive folders.</p>
        ) : null}
        <p className="small">
          In Google Cloud, create a Web OAuth client and turn on the Gmail API, Google Calendar API and Google Drive
          API. Scopes: Gmail modify, Gmail send, Calendar read, and Drive. Drive is needed because staff folders
          already exist and are chosen by link. Gmail send is what lets Send to finance and Send payslips write a new
          email. Nothing is archived, forwarded or filed until you press the button.
        </p>
        <div>
          Redirect URL
          <div className="setup-url">{google.redirectUri}</div>
        </div>
        <p className="small">Invoices are forwarded to {google.financeEmail}. Change that with FINANCE_EMAIL.</p>
        <div className="row">
          {google.configured && google.encryptionReady ? (
            <a className="btn" href="/api/google/start">
              {google.connected ? "Connect Google again" : "Connect Google"}
            </a>
          ) : (
            <button className="btn" type="button" disabled>
              Connect Google
            </button>
          )}
          {google.connected ? (
            <button className="btn ghost" type="button" onClick={disconnect} disabled={pending}>
              {pending ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
