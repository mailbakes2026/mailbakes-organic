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
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; labelled?: boolean; sentTo?: string };
  if (!response.ok) throw new Error(data.error || "That didn't work. Try again.");
  return data;
}

export function InboxBoard({
  messages,
  refreshedAt,
  financeEmail,
  notice,
}: {
  messages: MailItem[];
  refreshedAt: string | null;
  financeEmail: string;
  notice: string | null;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(notice);

  const visible = useMemo(() => messages.filter((message) => !hidden.includes(message.id)), [messages, hidden]);
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
      if (extra.truncated) bits.push("Showing the latest 50. Archive some, then refresh, to see the rest.");
      setInfo(bits.join(" "));
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

      {visible.length === 0 ? (
        <section className="card">
          <h2>Nothing needing you</h2>
          <p className="muted">
            Press Refresh to pull the latest from the inbox. Mail is grouped into MailBakes, suppliers, invoices and
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
                          <span className="mail-from">{who}</span>
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
                        Open in Gmail
                      </a>
                      <button className="btn ghost sm" type="button" onClick={() => archive([message.id])} disabled={pending !== null}>
                        Archive
                      </button>
                      <button className="btn ghost sm" type="button" onClick={() => addRun(message)} disabled={pending !== null}>
                        {pending === `run-${message.id}` ? "Adding…" : "Add to run-through"}
                      </button>
                      {message.group === "INVOICES" && confirmId !== message.id ? (
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
