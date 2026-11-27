"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RateBar } from "@/components/rate-bar";
import { formatCount, formatMoney, formatRate } from "@/lib/format";

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
}: {
  spotlight: CampaignRow[];
  spotlightLabel: string;
  month: CampaignRow[];
  week: CampaignRow[];
  monthAverage: Averages;
  weekAverage: Averages;
  today: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CampaignRow | null>(null);
  const rows = [...month, ...week];

  useEffect(() => {
    if (!selected) return;
    const next = rows.find((row) => row.id === selected.id && row.window === selected.window);
    if (next && (next.design?.id !== selected.design?.id || next.calendarId !== selected.calendarId)) setSelected(next);
    // Refresh the open row when stored designs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, week]);

  return (
    <>
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
              <button key={`${row.window}:${row.id}`} className="spotlight-card" type="button" onClick={() => setSelected(row)}>
                <span className={`rank is-${index + 1}`}>{index + 1}</span>
                <Thumb row={row} />
                <span className="spotlight-copy">
                  <b>{row.name}</b>
                  <strong>{row.revenuePence === null ? "—" : formatMoney(row.revenuePence, row.currency || "GBP")}</strong>
                  <span className="muted small">
                    Open {formatRate(row.openRate) ?? "—"} · Click {formatRate(row.clickRate) ?? "—"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
      <CampaignList title="Last 30 days" rows={month} onOpen={setSelected} />
      <CampaignList title="Last 7 days" rows={week} onOpen={setSelected} />
      {selected ? (
        <CampaignDrawer
          row={selected}
          average={selected.window === "7d" ? weekAverage : monthAverage}
          today={today}
          onClose={() => setSelected(null)}
          onUpdated={(next) => {
            setSelected(next);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function CampaignList({ title, rows, onOpen }: { title: string; rows: CampaignRow[]; onOpen: (row: CampaignRow) => void }) {
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
            <button key={`${row.window}:${row.id}`} className="camp-row" type="button" onClick={() => onOpen(row)}>
              <Thumb row={row} />
              <span className="camp-copy">
                <b>{row.name}</b>
                <strong>{row.revenuePence === null ? "—" : formatMoney(row.revenuePence, row.currency || "GBP")}</strong>
              </span>
              <span className="camp-rates">
                <RateBar label="Revenue" value={row.revenuePence === null ? "—" : formatMoney(row.revenuePence, row.currency || "GBP")} width={row.revenuePence === null ? 0 : (row.revenuePence / maxRevenue) * 100} />
                <RateBar label="Open" value={formatRate(row.openRate) ?? "—"} width={(row.openRate ?? 0) * 100} />
                <RateBar label="Click" value={formatRate(row.clickRate) ?? "—"} width={(row.clickRate ?? 0) * 100} />
                <RateBar label="Placed order" value="Not stored" width={0} />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Thumb({ row }: { row: CampaignRow }) {
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
  onClose,
  onUpdated,
}: {
  row: CampaignRow;
  average: Averages;
  today: string;
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

  useEffect(() => {
    setSendDate(row.sendDate || today);
    setError(null);
    setHtml("");
    setLightbox(false);
  }, [row, today]);

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

  const windowLabel = row.window === "7d" ? "Last 7 days" : "Last 30 days";
  return (
    <div className="cal-drawer">
      <button className="cal-scrim" type="button" aria-label="Close campaign" onClick={onClose} />
      <div className="cal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="cal-panel-head">
          <div>
            <p className="eyebrow">{windowLabel}</p>
            <h2 id={titleId}>{row.name}</h2>
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
          <p className="muted small">Revenue is the stored Klaviyo total for this window. The mark on each bar is the account average.</p>
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
          <h3>Design</h3>
          {row.design ? (
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
            <p className="muted">No design is linked yet. Upload a PNG, JPG, WebP, or HTML file.</p>
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
