"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GROUP_LABEL, GROUP_ORDER, type EmailGroupName } from "@/lib/classify";
import { formatLondonStamp } from "@/lib/dates";

export type MailItem = {
  id: string;
  group: EmailGroupName;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: string;
  unread: boolean;
  attachments: { filename: string; size: number }[];
  gmailUrl: string;
  accountId: string;
};

export type Inbox = {
  id: string;
  label: string;
  email: string;
  provider: "gmail" | "outlook";
  providerLabel: string;
  lastError: string;
  removable: boolean;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    labelled?: boolean;
    sentTo?: string;
    problems?: { account: string; error: string }[];
  };
  if (!response.ok) throw new Error(data.error || "That didn't work. Try again.");
  return data;
}

export function InboxBoard({
  messages,
  refreshedAt,
  financeEmail,
  notice,
  inboxes,
  outlookReady,
}: {
  messages: MailItem[];
  refreshedAt: string | null;
  financeEmail: string;
  notice: string | null;
  inboxes: Inbox[];
  outlookReady: boolean;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(notice);

  const [only, setOnly] = useState<string>("all");
  const [manage, setManage] = useState(inboxes.length === 0);
  const inboxById = useMemo(() => new Map(inboxes.map((inbox) => [inbox.id, inbox])), [inboxes]);
  const showBadges = inboxes.length > 1;
  const visible = useMemo(
    () => messages.filter((message) => !hidden.includes(message.id) && (only === "all" || message.accountId === only)),
    [messages, hidden, only],
  );
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABEL[group],
    items: visible.filter((message) => message.group === group),
  })).filter((group) => group.items.length > 0);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleGroup(ids: string[]) {
    const allOn = ids.every((id) => selected.includes(id));
    setSelected((current) => (allOn ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]));
  }

  async function refresh() {
    setPending("refresh");
    setError(null);
    try {
      const data = await postJson("/api/inbox/refresh", {});
      const extra = data as { count?: number; failed?: number; truncated?: boolean };
      const bits = [`Pulled ${extra.count ?? 0} from the inbox.`];
      if (extra.failed) bits.push(`${extra.failed} could not be read.`);
      if (extra.truncated) bits.push("Showing the latest 50 per inbox. Archive some, then refresh, to see the rest.");
      setInfo(bits.join(" "));
      if (data.problems?.length) setError(data.problems.map((problem) => `${problem.account}: ${problem.error}`).join(" "));
      setHidden([]);
      setSelected([]);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The inbox could not be refreshed.");
    } finally {
      setPending(null);
    }
  }

  async function archive(ids: string[]) {
    setPending("archive");
    setError(null);
    try {
      await postJson("/api/inbox/archive", { ids });
      setHidden((current) => [...current, ...ids]);
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      setInfo(ids.length === 1 ? "Archived. It is still in All Mail." : `Archived ${ids.length}. They are still in All Mail.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Those emails could not be archived.");
    } finally {
      setPending(null);
    }
  }

  async function sendFinance(id: string) {
    setPending(id);
    setError(null);
    try {
      const data = await postJson("/api/inbox/finance", { id });
      setHidden((current) => [...current, id]);
      setConfirmId(null);
      setInfo(
        data.labelled
          ? `Sent to ${data.sentTo} and archived, with the Sent to finance label.`
          : `Sent to ${data.sentTo}. It is still in the inbox, so archive it if you are finished with it.`,
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That invoice could not be sent.");
    } finally {
      setPending(null);
    }
  }

  async function addRun(message: MailItem) {
    setPending(`run-${message.id}`);
    setError(null);
    try {
      await postJson("/api/board/items", {
        title: message.subject,
        status: "waiting",
        notes: message.fromName ? `From ${message.fromName}` : `From ${message.fromEmail}`,
        emailUrl: message.gmailUrl,
      });
      setInfo("Added to the run-through.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That could not be added to the run-through.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p className="muted">
            {refreshedAt ? `Last refreshed ${formatLondonStamp(refreshedAt)}.` : "Nothing pulled yet."} Archive only
            happens when you press Archive. Invoices go to finance only when you confirm Send to finance.
          </p>
        </div>
        <button className="btn" type="button" onClick={refresh} disabled={pending !== null}>
          {pending === "refresh" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {info ? <p className="alert ok">{info}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="ib-bar">
        {inboxes.length > 1 ? (
          <div className="ib-chips" role="tablist" aria-label="Which inbox">
            {[{ id: "all", label: "All" }, ...inboxes].map((inbox) => {
              const count = messages.filter((m) => !hidden.includes(m.id) && (inbox.id === "all" || m.accountId === inbox.id)).length;
              return (
                <button
                  key={inbox.id}
                  type="button"
                  role="tab"
                  aria-selected={only === inbox.id}
                  className={`ib-chip${only === inbox.id ? " on" : ""}`}
                  onClick={() => setOnly(inbox.id)}
                >
                  {inbox.label} <span>{count}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <span />
        )}
        <button className="subtle" type="button" onClick={() => setManage((open) => !open)}>
          {manage ? "Hide inboxes" : `Inboxes (${inboxes.length})`}
        </button>
      </div>

      {manage ? (
        <InboxManager
          inboxes={inboxes}
          outlookReady={outlookReady}
          onChanged={(message) => {
            setInfo(message);
            setError(null);
            router.refresh();
          }}
          onError={setError}
        />
      ) : null}

      {visible.length === 0 ? (
        <section className="card">
          <h2>Nothing needing you</h2>
          <p className="muted">
            {inboxes.length === 0 ? "Connect Google or add an inbox first, then press Refresh. " : null}
            Press Refresh to pull the latest from your inboxes. Mail is grouped into MailBakes, suppliers, invoices and
            personal. An invoice mentions a bill or a receipt. A supplier mentions an order or a delivery, or a domain
            listed in SUPPLIER_DOMAINS. MailBakes is anything else from @mailbakes.com. The rest is personal.
          </p>
        </section>
      ) : (
        grouped.map((group) => (
          <section key={group.group} className="group-block">
            <div className="group-head">
              <h2>
                {group.label} <span className="pill">{group.items.length}</span>
              </h2>
              <button className="subtle" type="button" onClick={() => toggleGroup(group.items.map((item) => item.id))}>
                {group.items.every((item) => selected.includes(item.id)) ? "Clear" : "Select all"}
              </button>
            </div>
            <div className="mail-list">
              {group.items.map((message) => {
                const who = message.fromName || message.fromEmail || "Unknown";
                return (
                  <article key={message.id} className={`mail-card${message.unread ? " unread" : ""}`}>
                    <div className="mail-top">
                      <label className="checkline">
                        <input
                          type="checkbox"
                          checked={selected.includes(message.id)}
                          onChange={() => toggle(message.id)}
                          aria-label={`Select ${message.subject}`}
                        />
                      </label>
                      <div className="mail-main">
                        <div className="mail-line">
                          <span className="mail-from">
                            {who}
                            {showBadges ? (
                              <span className={`ib-badge ib-${inboxById.get(message.accountId)?.provider ?? "gmail"}`}>
                                {inboxById.get(message.accountId)?.label ?? "Inbox"}
                              </span>
                            ) : null}
                          </span>
                          <span className="small muted">{formatLondonStamp(message.receivedAt)}</span>
                        </div>
                        <div className="mail-subject">{message.subject}</div>
                        {message.fromEmail ? <div className="small muted">{message.fromEmail}</div> : null}
                        <p className="muted">{message.snippet}</p>
                      </div>
                    </div>
                    <details>
                      <summary>Quick view</summary>
                      <p className="mail-body">{message.bodyText || message.snippet || "This email has no text."}</p>
                      {message.attachments.length > 0 ? (
                        <p className="small">
                          Attachments: {message.attachments.map((file) => file.filename).join(", ")}
                        </p>
                      ) : null}
                    </details>
                    <div className="row">
                      <a href={message.gmailUrl} target="_blank" rel="noreferrer">
                        Open in {inboxById.get(message.accountId)?.providerLabel ?? "Gmail"}
                      </a>
                      <button className="btn ghost sm" type="button" onClick={() => archive([message.id])} disabled={pending !== null}>
                        Archive
                      </button>
                      <button className="btn ghost sm" type="button" onClick={() => addRun(message)} disabled={pending !== null}>
                        {pending === `run-${message.id}` ? "Adding…" : "Add to run-through"}
                      </button>
                      {message.group === "INVOICES" && message.accountId === "work" && confirmId !== message.id ? (
                        <button className="btn sm" type="button" onClick={() => setConfirmId(message.id)} disabled={pending !== null}>
                          Send to finance
                        </button>
                      ) : null}
                    </div>
                    {confirmId === message.id ? (
                      <div className="row">
                        <span>Send this invoice, with its attachments, to {financeEmail}?</span>
                        <button className="btn sm" type="button" onClick={() => sendFinance(message.id)} disabled={pending !== null}>
                          {pending === message.id ? "Sending…" : `Send to ${financeEmail}`}
                        </button>
                        <button className="btn ghost sm" type="button" onClick={() => setConfirmId(null)} disabled={pending !== null}>
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      {selected.length > 0 ? (
        <div className="bulk-bar">
          <span>
            {selected.length} selected
          </span>
          <button className="btn sm" type="button" onClick={() => archive(selected)} disabled={pending !== null}>
            {pending === "archive" ? "Archiving…" : "Archive selected"}
          </button>
          <button className="btn ghost sm" type="button" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}

function InboxManager({
  inboxes,
  outlookReady,
  onChanged,
  onError,
}: {
  inboxes: Inbox[];
  outlookReady: boolean;
  onChanged: (message: string) => void;
  onError: (message: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("Personal");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function addGmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy("add");
    onError(null);
    try {
      await postJson("/api/mail-accounts", { email, label, appPassword: password });
      setPassword("");
      setEmail("");
      setAdding(false);
      onChanged(`${label || "Personal"} Gmail added. Press Refresh to pull it in.`);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "That inbox could not be added.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(inbox: Inbox) {
    setBusy(inbox.id);
    onError(null);
    try {
      const response = await fetch(`/api/mail-accounts/${encodeURIComponent(inbox.id)}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "That inbox could not be removed.");
      setConfirmRemove(null);
      onChanged(`${inbox.label} removed from the app. Nothing in the mailbox was changed.`);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "That inbox could not be removed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card ib-manage">
      <h2>Your inboxes</h2>
      {inboxes.length === 0 ? <p className="muted">No inboxes connected yet.</p> : null}
      <ul className="ib-list">
        {inboxes.map((inbox) => (
          <li key={inbox.id}>
            <div>
              <strong>{inbox.label}</strong> <span className="small muted">{inbox.providerLabel}</span>
              <div className="small muted">{inbox.email}</div>
              {inbox.lastError ? <div className="small ib-err">{inbox.lastError}</div> : null}
            </div>
            {inbox.removable ? (
              confirmRemove === inbox.id ? (
                <div className="row">
                  <button className="btn sm danger" type="button" disabled={busy !== null} onClick={() => remove(inbox)}>
                    {busy === inbox.id ? "Removing…" : "Remove"}
                  </button>
                  <button className="btn ghost sm" type="button" onClick={() => setConfirmRemove(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="subtle" type="button" onClick={() => setConfirmRemove(inbox.id)}>
                  Remove
                </button>
              )
            ) : (
              <span className="small muted">Main</span>
            )}
          </li>
        ))}
      </ul>

      <div className="row">
        <button className="btn ghost sm" type="button" onClick={() => setAdding((open) => !open)}>
          {adding ? "Cancel" : "+ Add Gmail"}
        </button>
        {outlookReady ? (
          <a className="btn ghost sm" href="/api/microsoft/start">
            + Connect Outlook
          </a>
        ) : (
          <span className="small muted">Outlook: waiting for the Microsoft keys on Render.</span>
        )}
      </div>

      {adding ? (
        <form className="ib-form" onSubmit={addGmail}>
          <p className="small muted">
            Gmail needs an <strong>app password</strong>, not your normal one. Make one at{" "}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              myaccount.google.com/apppasswords
            </a>{" "}
            (2-Step Verification must be on), then paste the 16 letters here.
          </p>
          <label className="field">
            <span>Gmail address</span>
            <input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Name in the app</span>
            <input value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="field">
            <span>App password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="abcd efgh ijkl mnop"
              required
            />
          </label>
          <button className="btn sm" type="submit" disabled={busy !== null}>
            {busy === "add" ? "Checking…" : "Add Gmail"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
