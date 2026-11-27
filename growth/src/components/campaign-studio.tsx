"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RateBar } from "@/components/rate-bar";
import { WeekDelta } from "@/components/week-delta";
import { formatCount, formatMoney, formatRate } from "@/lib/format";
import { benchmarkNote, campaignCallouts, klaviyoCampaignUrl } from "@/lib/retention/attention";

export type CampaignRow = {
  id: string;
  name: string;
  window: "7d" | "30d";
  revenuePence: number | null;
  currency: string;
  delivered: number | null;
  openRate: number | null;
  clickRate: number | null;
  opens: number | null;
  clicks: number | null;
  unsubscribes: number | null;
  calendarId: string | null;
  sendDate: string | null;
  audience: string;
  subject: string;
  design: { id: string; mimeType: string; filename: string } | null;
  previewHtml: string;
  weekRevenuePence: number | null;
  previousRevenuePence: number | null;
  weekOpenRate: number | null;
};

type Averages = { openRate: number | null; clickRate: number | null };

async function sendJson(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; campaign?: { id: string } };
  if (!response.ok) throw new Error(data.error || "That was not saved.");
  return data;
}

export function CampaignStudio({
  spotlight,
  spotlightLabel,
  month,
  week,
  monthAverage,
  weekAverage,
  today,
  author,
}: {
  spotlight: CampaignRow[];
  spotlightLabel: string;
  month: CampaignRow[];
  week: CampaignRow[];
  monthAverage: Averages;
  weekAverage: Averages;
  today: string;
  author: "Millie" | "Kyle";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{ row: CampaignRow; note: boolean } | null>(null);
  const rows = [...month, ...week];
  const callouts = campaignCallouts(
    uniqueRows(week.length ? week : month).map((row) => ({
      id: row.id,
      name: row.name,
      weekRevenuePence: row.weekRevenuePence,
      previousRevenuePence: row.previousRevenuePence,
      currency: row.currency,
      weekOpenRate: row.weekOpenRate,
      averageOpenRate: week.length ? weekAverage.openRate : monthAverage.openRate,
      hasVisual: Boolean(row.previewHtml || row.design),
    })),
  );

  useEffect(() => {
    if (!selected) return;
    const next = rows.find((row) => row.id === selected.row.id && row.window === selected.row.window);
    if (next && (next.design?.id !== selected.row.design?.id || next.calendarId !== selected.row.calendarId || next.previewHtml !== selected.row.previewHtml)) {
      setSelected({ row: next, note: selected.note });
    }
    // Refresh the open row when stored designs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, week]);

  return (
    <>
      <section className="attention" aria-label="Needs attention">
        <h2>Needs attention</h2>
        {callouts.length ? callouts.map((note) => <p key={note}>{note}</p>) : <p>Nothing needs attention this week.</p>}
      </section>
      <section className="stack-section" aria-label="What's working well">
        <h2 className="section-title">What&apos;s working well</h2>
        <p className="muted small">Top campaigns by revenue, {spotlightLabel}.</p>
        {spotlight.length === 0 ? (
          <article className="card">
            <p className="empty-state">No campaign revenue is stored yet, so there is no top three.</p>
          </article>
        ) : (
          <div className="spotlight">
            {spotlight.map((row, index) => (
              <article key={`${row.window}:${row.id}`} className="spotlight-card">
                <span className={`rank is-${index + 1}`}>{index + 1}</span>
                <Thumb row={row} />
                <button className="spotlight-copy" type="button" onClick={() => setSelected({ row, note: false })}>
                  <b>{row.name}</b>
                  <strong>{row.revenuePence === null ? "Not stored" : formatMoney(row.revenuePence, row.currency || "GBP")}</strong>
                  <WeekDelta current={row.weekRevenuePence} previous={row.previousRevenuePence} currency={row.currency || "GBP"} />
                  <span className="muted small">
                    Open {formatRate(row.openRate) ?? "Not stored"} · Click {formatRate(row.clickRate) ?? "Not stored"}
                  </span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      <CampaignList title="Last 30 days" rows={month} average={monthAverage} onOpen={(row, note) => setSelected({ row, note })} />
      <CampaignList title="Last 7 days" rows={week} average={weekAverage} onOpen={(row, note) => setSelected({ row, note })} />
      {selected ? (
        <CampaignDrawer
          row={selected.row}
          average={selected.row.window === "7d" ? weekAverage : monthAverage}
          today={today}
          author={author}
          startNote={selected.note}
          onClose={() => setSelected(null)}
          onUpdated={(next) => {
            setSelected({ row: next, note: selected.note });
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function uniqueRows(rows: CampaignRow[]) {
  return rows.filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index);
}

function CampaignList({
  title,
  rows,
  average,
  onOpen,
}: {
  title: string;
  rows: CampaignRow[];
  average: Averages;
  onOpen: (row: CampaignRow, note: boolean) => void;
}) {
  const maxRevenue = Math.max(1, ...rows.map((row) => row.revenuePence ?? 0));
  return (
    <section className="stack-section" aria-label={title}>
      <h2 className="section-title">{title}</h2>
      {rows.length === 0 ? (
        <article className="card">
          <p className="empty-state">Nothing is stored for this window.</p>
        </article>
      ) : (
        <div className="camp-list">
          {rows.map((row) => (
            <article key={`${row.window}:${row.id}`} className="camp-row">
              <div className="camp-main">
                <Thumb row={row} />
                <button className="camp-open" type="button" onClick={() => onOpen(row, false)}>
                  <span className="camp-copy">
                    <b>{row.name}</b>
                    <strong>{row.revenuePence === null ? "Not stored" : formatMoney(row.revenuePence, row.currency || "GBP")}</strong>
                    <WeekDelta current={row.weekRevenuePence} previous={row.previousRevenuePence} currency={row.currency || "GBP"} />
                    <span className="muted small">{benchmarkNote(row.window === "7d" ? row.weekOpenRate : row.openRate, average.openRate) ?? "No account average yet."}</span>
                  </span>
                  <span className="camp-rates">
                    <RateBar label="Revenue" value={row.revenuePence === null ? "Not stored" : formatMoney(row.revenuePence, row.currency || "GBP")} width={row.revenuePence === null ? 0 : (row.revenuePence / maxRevenue) * 100} />
                    <RateBar label="Open" value={formatRate(row.openRate) ?? "Not stored"} width={(row.openRate ?? 0) * 100} />
                    <RateBar label="Click" value={formatRate(row.clickRate) ?? "Not stored"} width={(row.clickRate ?? 0) * 100} />
                    <RateBar label="Placed order" value="Not stored" width={0} />
                  </span>
                </button>
              </div>
              <CampaignActions row={row} onNote={() => onOpen(row, true)} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CampaignActions({ row, onNote }: { row: CampaignRow; onNote: () => void }) {
  const href = klaviyoCampaignUrl(row.id);
  return (
    <span className="camp-actions">
      {href ? (
        <a className="btn ghost sm" href={href} target="_blank" rel="noreferrer">
          Open in Klaviyo
        </a>
      ) : null}
      <button className="btn ghost sm" type="button" onClick={onNote}>
        Log note / test
      </button>
    </span>
  );
}

function Thumb({ row }: { row: CampaignRow }) {
  if (row.previewHtml) {
    return (
      <span className="email-thumb">
        <iframe sandbox="" tabIndex={-1} srcDoc={row.previewHtml} title={`${row.name} preview`} />
      </span>
    );
  }
  if (row.design?.mimeType.startsWith("image/")) {
    return <img className="camp-thumb" src={`/api/retention/calendar/designs/${row.design.id}`} alt="" />;
  }
  if (row.design?.mimeType === "text/html") return <span className="camp-thumb is-html">HTML</span>;
  return <span className="camp-thumb is-empty" aria-hidden="true">{row.name.slice(0, 1).toUpperCase()}</span>;
}

function gapNote(rate: number | null, average: number | null) {
  if (rate === null) return "Not stored on this campaign.";
  if (average === null) return "No account average yet.";
  const points = (rate - average) * 100;
  const figure = `${points > 0 ? "+" : ""}${points.toFixed(1)} pts`;
  if (Math.abs(points) < 0.05) return `In line with the account average of ${formatRate(average)}.`;
  return `${figure} ${points > 0 ? "above" : "below"} the account average of ${formatRate(average)}.`;
}

function CampaignDrawer({
  row,
  average,
  today,
  author,
  startNote,
  onClose,
  onUpdated,
}: {
  row: CampaignRow;
  average: Averages;
  today: string;
  author: "Millie" | "Kyle";
  startNote: boolean;
  onClose: () => void;
  onUpdated: (row: CampaignRow) => void;
}) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sendDate, setSendDate] = useState(row.sendDate || today);
  const [html, setHtml] = useState("");
  const [lightbox, setLightbox] = useState(false);
  const [noteOpen, setNoteOpen] = useState(startNote);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSendDate(row.sendDate || today);
    setError(null);
    setHtml("");
    setLightbox(false);
    setNoteOpen(startNote);
    setNote("");
    setSaved(false);
  }, [row, today, startNote]);

  useEffect(() => {
    if (row.design?.mimeType !== "text/html") return;
    let cancel = false;
    fetch(`/api/retention/calendar/designs/${row.design.id}`)
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => {
        if (!cancel) setHtml(text);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [row.design]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (lightbox) setLightbox(false);
      else onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox]);

  async function upload(file: File) {
    setPending(true);
    setError(null);
    try {
      let calendarId = row.calendarId;
      if (!calendarId) {
        const created = await sendJson("/api/retention/calendar/campaigns", "POST", {
          title: row.name,
          status: "sent",
          channel: "email",
          sendDate,
          klaviyoCampaignId: /^[A-Za-z0-9]{6,32}$/.test(row.id) ? row.id : "",
          notes: "Design attached from Campaigns.",
        });
        calendarId = created.campaign?.id ?? null;
        if (!calendarId) throw new Error("The calendar send was not created.");
      }
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/retention/calendar/campaigns/${calendarId}/designs`, { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as { error?: string; design?: { id: string; mimeType: string; filename: string } };
      if (!response.ok || !data.design) throw new Error(data.error || "That design was not saved.");
      onUpdated({
        ...row,
        calendarId,
        sendDate,
        design: { id: data.design.id, mimeType: data.design.mimeType, filename: data.design.filename },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That design was not saved.");
    } finally {
      setPending(false);
    }
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await sendJson("/api/retention/notes", "POST", { author, body: `${row.name}\n${note.trim()}` });
      setNote("");
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That note was not saved.");
    } finally {
      setPending(false);
    }
  }

  const windowLabel = row.window === "7d" ? "Last 7 days" : "Last 30 days";
  const klaviyo = klaviyoCampaignUrl(row.id);
  const context = benchmarkNote(row.openRate, average.openRate);
  return (
    <div className="cal-drawer">
      <button className="cal-scrim" type="button" aria-label="Close campaign" onClick={onClose} />
      <div className="cal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="cal-panel-head">
          <div>
            <p className="eyebrow">{windowLabel}</p>
            <h2 id={titleId}>{row.name}</h2>
            <WeekDelta current={row.weekRevenuePence} previous={row.previousRevenuePence} currency={row.currency || "GBP"} />
          </div>
          <button className="btn ghost sm" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <section className="cal-section">
          <h3>Performance</h3>
          <div className="kpi-grid">
            <Kpi label="Revenue" value={row.revenuePence === null ? null : formatMoney(row.revenuePence, row.currency || "GBP")} />
            <Kpi label="Recipients" value={formatCount(row.delivered)} />
            <Kpi label="Opens" value={formatCount(row.opens)} />
            <Kpi label="Clicks" value={formatCount(row.clicks)} />
            <Kpi label="Unsubscribes" value={formatCount(row.unsubscribes)} />
            <Kpi label="Placed order rate" value={null} />
          </div>
          <RateBar label="Open" value={formatRate(row.openRate) ?? "—"} width={(row.openRate ?? 0) * 100} marker={average.openRate === null ? null : average.openRate * 100} note={gapNote(row.openRate, average.openRate)} />
          <RateBar label="Click" value={formatRate(row.clickRate) ?? "—"} width={(row.clickRate ?? 0) * 100} marker={average.clickRate === null ? null : average.clickRate * 100} note={gapNote(row.clickRate, average.clickRate)} />
          <RateBar label="Placed order" value="Not stored" width={0} note="Orders and placed order rate are not on the stored campaign row." />
          <p className="muted small">{context ?? "No account average yet."} Revenue is the stored Klaviyo total for this window.</p>
          <div className="row">
            {klaviyo ? (
              <a className="btn ghost sm" href={klaviyo} target="_blank" rel="noreferrer">
                Open in Klaviyo
              </a>
            ) : null}
            <button className="btn ghost sm" type="button" onClick={() => setNoteOpen((open) => !open)}>
              Log note / test
            </button>
          </div>
          {noteOpen ? (
            <form className="test-form" onSubmit={saveNote}>
              <label className="field">
                Note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} placeholder="What you changed, or the test to run" required />
              </label>
              <button className="btn sm" type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save note"}
              </button>
              {saved ? <p className="muted small">Saved. It is with the review notes in Settings.</p> : null}
            </form>
          ) : null}
        </section>
        <section className="cal-section">
          <h3>Send</h3>
          <dl className="cal-facts">
            <div>
              <dt>Date</dt>
              <dd>{row.sendDate || "Not on the calendar yet"}</dd>
            </div>
            <div>
              <dt>Audience</dt>
              <dd>{row.audience || "Not stored"}</dd>
            </div>
            <div>
              <dt>Subject</dt>
              <dd>{row.subject || "Not stored"}</dd>
            </div>
          </dl>
        </section>
        <section className="cal-section">
          <h3>Email</h3>
          {row.previewHtml ? (
            <div className="email-scroll">
              <iframe sandbox="" srcDoc={row.previewHtml} title={`${row.name} email`} />
            </div>
          ) : row.design ? (
            <div className="design-open">
              {row.design.mimeType.startsWith("image/") ? (
                <button type="button" onClick={() => setLightbox(true)}>
                  <img src={`/api/retention/calendar/designs/${row.design.id}`} alt={row.design.filename} />
                </button>
              ) : html ? (
                <iframe title={row.design.filename} sandbox="" srcDoc={html} />
              ) : (
                <p className="muted">Loading preview…</p>
              )}
              <button type="button" onClick={() => setLightbox(true)}>
                View full size
              </button>
            </div>
          ) : (
            <p className="muted">No email visual is stored yet. The next Klaviyo sync will pull it, or you can upload a PNG, JPG, WebP, or HTML file.</p>
          )}
          {row.calendarId ? null : (
            <label className="field">
              Calendar date for this design
              <input type="date" value={sendDate} onChange={(event) => setSendDate(event.target.value)} />
            </label>
          )}
          <label className="btn">
            {pending ? "Uploading…" : row.design ? "Replace design" : "Upload design"}
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp,text/html,.html,.htm,.png,.jpg,.jpeg,.webp"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
          {row.calendarId ? null : <p className="muted small">Uploading adds the design to the calendar on the date above.</p>}
        </section>
      </div>
      {lightbox && row.design ? (
        <div className="design-lightbox" role="dialog" aria-modal="true" aria-label="Email design">
          <button className="cal-scrim" type="button" aria-label="Close preview" onClick={() => setLightbox(false)} />
          <div className="design-lightbox-frame">
            {row.design.mimeType.startsWith("image/") ? (
              <img src={`/api/retention/calendar/designs/${row.design.id}`} alt={row.design.filename} />
            ) : (
              <iframe title={row.design.filename} sandbox="" srcDoc={html} />
            )}
            <button className="btn" type="button" onClick={() => setLightbox(false)}>
              Close preview
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | null }) {
  return (
    <article className="cal-metric">
      <span>{label}</span>
      <b className={value ? "" : "is-empty"}>{value ?? "—"}</b>
    </article>
  );
}
