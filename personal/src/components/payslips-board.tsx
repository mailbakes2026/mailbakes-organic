"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatLondonStamp } from "@/lib/dates";
import type { PayslipPreview } from "@/lib/payslips";

type Staff = { id: string; name: string; folderId: string; folderName: string; folderUrl: string };
type Line = {
  id: string;
  staffName: string;
  filename: string;
  outcome: "FILED" | "SKIPPED_DUPLICATE" | "UNMATCHED" | "MISSING" | "FAILED";
  detail: string;
};
type Run = {
  id: string;
  weekLabel: string;
  subject: string;
  createdAt: string;
  emailedJess: boolean;
  emailError: string;
  lines: Line[];
};

const OUTCOME: Record<Line["outcome"], string> = {
  FILED: "Filed",
  SKIPPED_DUPLICATE: "Already in the folder",
  UNMATCHED: "Unmatched",
  MISSING: "No payslip",
  FAILED: "Failed",
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

export function PayslipsBoard({
  staff,
  preview,
  previewError,
  runs,
  driveGranted,
  connected,
  jessEmail,
  paulEmail,
}: {
  staff: Staff[];
  preview: PayslipPreview | null;
  previewError: string;
  runs: Run[];
  driveGranted: boolean;
  connected: boolean;
  jessEmail: string;
  paulEmail: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [emailJess, setEmailJess] = useState(true);
  const [choices, setChoices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const file of preview?.files ?? []) initial[file.attachmentId] = file.staffId ?? "";
    return initial;
  });

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
      await send("POST", "/api/payslips/staff", { name: form.get("name"), folder: form.get("folder") });
      target.reset();
    });
  }

  async function onSave(person: Staff, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await send("PATCH", `/api/payslips/staff/${person.id}`, { name: form.get("name"), folder: form.get("folder") });
    });
  }

  async function onSend() {
    if (!preview?.found) return;
    setInfo(null);
    await run(async () => {
      const result = (await send("POST", "/api/payslips/send", {
        messageId: preview.messageId,
        emailJess,
        assignments: preview.files.map((file) => ({
          attachmentId: file.attachmentId,
          staffId: choices[file.attachmentId] || null,
        })),
      })) as { emailedJess?: boolean; emailError?: string; jess?: string };
      if (result.emailedJess) setInfo(`Filed, and a new email was sent to ${result.jess}. The original message was not forwarded.`);
      else if (result.emailError) setInfo(`Filed where it could be. ${result.emailError}`);
      else setInfo("Filed in Drive. Jess was not emailed.");
    });
  }

  const missingNames = (preview?.files ?? []).reduce((names, file) => {
    const chosen = choices[file.attachmentId];
    if (chosen) names.add(chosen);
    return names;
  }, new Set<string>());
  const missing = staff.filter((person) => preview?.found && !missingNames.has(person.id));
  const unmatched = (preview?.files ?? []).filter((file) => !choices[file.attachmentId]);

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Payslips</h1>
          <p className="muted">
            Paul sends one email a week. Each PDF is matched to a person by the file name, then filed in that
            Drive folder when you press the button. Bank details, phone numbers and emergency contacts are not shown
            and are not copied into the email.
          </p>
        </div>
        <a className="btn" href="/payslips">
          Refresh
        </a>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {info ? <p className="alert ok">{info}</p> : null}

      <section className="card">
        <h2>Staff folders</h2>
        <p className="muted">Paste the Google Drive folder link, or the folder id, for each person.</p>
        <form className="stack" onSubmit={onAdd}>
          <div className="grid">
            <label className="field" htmlFor="new-name">
              Name
              <input id="new-name" name="name" required maxLength={80} placeholder="Jess Smith" />
            </label>
            <label className="field" htmlFor="new-folder">
              Drive folder
              <input id="new-folder" name="folder" required placeholder="https://drive.google.com/drive/folders/..." />
            </label>
          </div>
          <button className="btn" type="submit" disabled={pending}>
            Add person
          </button>
        </form>
        {staff.length === 0 ? <p className="muted">No one on the list yet.</p> : null}
        <div className="stack-list">
          {staff.map((person) => (
            <form key={person.id} className="mail-card" onSubmit={(event) => onSave(person, event)}>
              <div className="grid">
                <label className="field">
                  Name
                  <input name="name" required maxLength={80} defaultValue={person.name} />
                </label>
                <label className="field">
                  Drive folder
                  <input name="folder" required defaultValue={person.folderUrl} />
                </label>
              </div>
              {person.folderName ? <p className="small muted">Folder: {person.folderName}</p> : null}
              <div className="row">
                <button className="btn sm" type="submit" disabled={pending}>
                  Save
                </button>
                <a href={person.folderUrl} target="_blank" rel="noreferrer">
                  Open folder
                </a>
                <button
                  className="subtle"
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => send("DELETE", `/api/payslips/staff/${person.id}`).then(() => undefined))}
                >
                  Remove
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>This week</h2>
        {previewError ? <p className="alert warn">{previewError}</p> : null}
        {!driveGranted ? (
          <p className="alert warn">Connect Google again before sending. Drive access is what lets a folder link be used.</p>
        ) : null}
        {!preview?.found ? (
          <p className="muted">
            {previewError
              ? "The latest payslips email could not be read."
              : connected
                ? `No payslips email from ${paulEmail} yet. Refresh after it arrives.`
                : "Connect Google to look for the latest payslips email."}
          </p>
        ) : (
          <>
            <p>
              <b>{preview.subject}</b>
              <span className="small muted"> · {formatLondonStamp(preview.receivedAt)} · week of {preview.weekLabel}</span>
            </p>
            {preview.alreadyFiled ? (
              <p className="muted">This email has been filed before. Sending again skips a PDF that is already in the folder.</p>
            ) : null}
            <div className="stack-list">
              {preview.files.map((file) => (
                <article key={file.attachmentId} className="mail-card">
                  <div className="mail-line">
                    <b>{file.filename}</b>
                    {!choices[file.attachmentId] ? (
                      <span className="pill hot">{file.state === "ambiguous" ? "Matches more than one person" : "Unmatched"}</span>
                    ) : (
                      <span className="pill ok">Matched</span>
                    )}
                  </div>
                  <label className="field">
                    Person
                    <select
                      value={choices[file.attachmentId] ?? ""}
                      onChange={(event) => setChoices((current) => ({ ...current, [file.attachmentId]: event.target.value }))}
                    >
                      <option value="">Unmatched</option>
                      {staff.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            </div>
            {missing.length > 0 ? (
              <p className="alert warn">
                No payslip for {missing.map((person) => person.name).join(", ")}.
              </p>
            ) : null}
            {unmatched.length > 0 ? (
              <p className="alert warn">{unmatched.length} PDF{unmatched.length === 1 ? "" : "s"} still unmatched. Those are not filed or emailed.</p>
            ) : null}
            {preview.ignored.length > 0 ? (
              <p className="small muted">Left out because they are not PDFs: {preview.ignored.join(", ")}.</p>
            ) : null}
            <label className="checkline">
              <input type="checkbox" checked={emailJess} onChange={(event) => setEmailJess(event.target.checked)} />
              <span>Also email the PDFs to Jess ({jessEmail}) as a new message. The original email is not forwarded.</span>
            </label>
            <button className="btn" type="button" disabled={pending || !driveGranted} onClick={onSend}>
              {pending ? "Sending…" : emailJess ? "Send payslips" : "File payslips in Drive"}
            </button>
          </>
        )}
      </section>

      <section>
        <h2>Log</h2>
        {runs.length === 0 ? <p className="muted">Nothing has been filed yet.</p> : null}
        {runs.map((run) => (
          <article key={run.id} className="card">
            <h2>Week of {run.weekLabel}</h2>
            <p className="small muted">
              {run.subject ? `${run.subject} · ` : ""}
              Filed {formatLondonStamp(run.createdAt)}
              {run.emailedJess ? " · emailed to Jess" : ""}
              {run.emailError ? ` · ${run.emailError}` : ""}
            </p>
            <div className="stack-list">
              {run.lines.map((line) => (
                <div key={line.id} className="mail-line">
                  <span>
                    {line.staffName || "Unmatched"}
                    {line.filename ? ` — ${line.filename}` : ""}
                  </span>
                  <span className={`pill${line.outcome === "FAILED" || line.outcome === "UNMATCHED" || line.outcome === "MISSING" ? " hot" : " ok"}`}>
                    {OUTCOME[line.outcome]}
                  </span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
