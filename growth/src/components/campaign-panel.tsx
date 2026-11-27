"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatLondon } from "@/lib/dates";
import { formatCount } from "@/lib/format";
import {
  CHANNEL_LABEL,
  CHANNELS,
  KLAVIYO_ATTRIBUTION_DETAIL,
  STATUS_LABEL,
  STATUSES,
  VERDICT_LABEL,
  formatCalendarRate,
  formatClock,
  formatMoneyPence,
  type CampaignJson,
  type Channel,
  type Status,
} from "@/lib/retention/calendar/model";

type Draft = {
  title: string;
  status: Status;
  channel: Channel;
  sendDate: string;
  sendTime: string;
  timeLabel: string;
  subject: string;
  previewText: string;
  audience: string;
  audienceSize: string;
  smartSending: "" | "true" | "false";
  offerCode: string;
  klaviyoCampaignId: string;
  notes: string;
  cardNote: string;
};

type ResultDraft = {
  openRate: string;
  clickRate: string;
  revenue: string;
  orders: string;
  recipients: string;
  delivered: string;
  opens: string;
  clicks: string;
  unsubscribes: string;
  unsubscribeRate: string;
  bounces: string;
  bounceRate: string;
  spamComplaints: string;
  spamRate: string;
  conversionRate: string;
  aov: string;
  attributionModel: string;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  status: "planned",
  channel: "email",
  sendDate: "",
  sendTime: "",
  timeLabel: "",
  subject: "",
  previewText: "",
  audience: "",
  audienceSize: "",
  smartSending: "",
  offerCode: "",
  klaviyoCampaignId: "",
  notes: "",
  cardNote: "",
};

function draftFrom(campaign: CampaignJson): Draft {
  return {
    title: campaign.title,
    status: campaign.status,
    channel: campaign.channel,
    sendDate: campaign.sendDate,
    sendTime: campaign.sendTime,
    timeLabel: campaign.timeLabel,
    subject: campaign.subject,
    previewText: campaign.previewText,
    audience: campaign.audience,
    audienceSize: campaign.audienceSize === null ? "" : String(campaign.audienceSize),
    smartSending: campaign.smartSending === null ? "" : campaign.smartSending ? "true" : "false",
    offerCode: campaign.offerCode,
    klaviyoCampaignId: campaign.klaviyoCampaignId,
    notes: campaign.notes,
    cardNote: campaign.cardNote,
  };
}

function percentInput(rate: number | null) {
  if (rate === null) return "";
  const pct = Math.round(rate * 10000) / 100;
  return String(pct);
}

function moneyInput(pence: number | null) {
  if (pence === null) return "";
  return (pence / 100).toFixed(2);
}

function countInput(value: number | null) {
  return value === null ? "" : String(value);
}

function resultsFrom(campaign: CampaignJson): ResultDraft {
  const results = campaign.results;
  return {
    openRate: percentInput(results.openRate),
    clickRate: percentInput(results.clickRate),
    revenue: moneyInput(results.revenuePence),
    orders: countInput(results.orders),
    recipients: countInput(results.recipients),
    delivered: countInput(results.delivered),
    opens: countInput(results.opens),
    clicks: countInput(results.clicks),
    unsubscribes: countInput(results.unsubscribes),
    unsubscribeRate: percentInput(results.unsubscribeRate),
    bounces: countInput(results.bounces),
    bounceRate: percentInput(results.bounceRate),
    spamComplaints: countInput(results.spamComplaints),
    spamRate: percentInput(results.spamRate),
    conversionRate: percentInput(results.conversionRate),
    aov: moneyInput(results.aovPence),
    attributionModel: results.attributionModel,
  };
}

async function sendJson(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; campaign?: CampaignJson };
  if (!response.ok) throw new Error(data.error || "That was not saved.");
  return data;
}

function percentOrNull(value: string, label: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new Error(`${label} must be a percentage from 0 to 100.`);
  return Math.round(number * 10000) / 1_000_000;
}

function countOrNull(value: string, label: string) {
  if (!value.trim()) return null;
  if (!/^\d+$/.test(value.trim())) throw new Error(`${label} must be a whole number, or blank.`);
  return Number(value.trim());
}

function smartLabel(value: boolean | null) {
  if (value === null) return "Not set";
  return value ? "On" : "Off";
}

export function CampaignPanel({
  campaign,
  defaultDate,
  actor,
  klaviyoConnected,
  onClose,
  onChange,
}: {
  campaign: CampaignJson | null;
  defaultDate: string;
  actor: string;
  klaviyoConnected: boolean;
  onClose: () => void;
  onChange: (nextId?: string) => Promise<void>;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<Draft>(campaign ? draftFrom(campaign) : { ...EMPTY_DRAFT, sendDate: defaultDate });
  const [results, setResults] = useState<ResultDraft | null>(campaign ? resultsFrom(campaign) : null);
  const [author, setAuthor] = useState(actor);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [html, setHtml] = useState<Record<string, string>>({});

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setDraft(campaign ? draftFrom(campaign) : { ...EMPTY_DRAFT, sendDate: defaultDate });
    setResults(campaign ? resultsFrom(campaign) : null);
    setError(null);
    setConfirmDelete(false);
    setComment("");
    setHtml({});
  }, [campaign, defaultDate]);

  useEffect(() => {
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!campaign) return;
    let cancel = false;
    for (const design of campaign.designs) {
      if (design.mimeType !== "text/html") continue;
      fetch(`/api/retention/calendar/designs/${design.id}`)
        .then((response) => (response.ok ? response.text() : ""))
        .then((text) => {
          if (!cancel && text) setHtml((current) => ({ ...current, [design.id]: text }));
        })
        .catch(() => undefined);
    }
    return () => {
      cancel = true;
    };
  }, [campaign]);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveSetup(event: React.FormEvent) {
    event.preventDefault();
    setPending("setup");
    setError(null);
    try {
      const payload = {
        title: draft.title,
        status: draft.status,
        channel: draft.channel,
        sendDate: draft.sendDate,
        sendTime: draft.sendTime,
        timeLabel: draft.timeLabel,
        subject: draft.subject,
        previewText: draft.previewText,
        audience: draft.audience,
        audienceSize: draft.audienceSize.trim() ? Number(draft.audienceSize) : null,
        smartSending: draft.smartSending === "" ? null : draft.smartSending === "true",
        offerCode: draft.offerCode,
        klaviyoCampaignId: draft.klaviyoCampaignId,
        notes: draft.notes,
        cardNote: draft.cardNote,
      };
      if (campaign) {
        await sendJson(`/api/retention/calendar/campaigns/${campaign.id}`, "PATCH", payload);
        await onChange(campaign.id);
      } else {
        const saved = await sendJson("/api/retention/calendar/campaigns", "POST", payload);
        await onChange(saved.campaign?.id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That was not saved.");
    } finally {
      setPending("");
    }
  }

  async function saveResults(event: React.FormEvent) {
    event.preventDefault();
    if (!campaign || !results) return;
    setPending("results");
    setError(null);
    try {
      await sendJson(`/api/retention/calendar/campaigns/${campaign.id}`, "PATCH", {
        results: {
          openRate: percentOrNull(results.openRate, "Open rate"),
          clickRate: percentOrNull(results.clickRate, "Click rate"),
          unsubscribeRate: percentOrNull(results.unsubscribeRate, "Unsubscribe rate"),
          bounceRate: percentOrNull(results.bounceRate, "Bounce rate"),
          spamRate: percentOrNull(results.spamRate, "Spam rate"),
          conversionRate: percentOrNull(results.conversionRate, "Conversion rate"),
          revenue: results.revenue.trim() || null,
          aov: results.aov.trim() || null,
          orders: countOrNull(results.orders, "Orders"),
          recipients: countOrNull(results.recipients, "Recipients"),
          delivered: countOrNull(results.delivered, "Delivered"),
          opens: countOrNull(results.opens, "Opens"),
          clicks: countOrNull(results.clicks, "Clicks"),
          unsubscribes: countOrNull(results.unsubscribes, "Unsubscribes"),
          bounces: countOrNull(results.bounces, "Bounces"),
          spamComplaints: countOrNull(results.spamComplaints, "Spam complaints"),
          attributionModel: results.attributionModel,
        },
      });
      await onChange(campaign.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Those results were not saved.");
    } finally {
      setPending("");
    }
  }

  async function syncOne() {
    if (!campaign) return;
    setPending("sync");
    setError(null);
    try {
      const data = await sendJson("/api/retention/calendar/sync", "POST", { campaignId: campaign.id });
      const unchanged = (data as { unchanged?: { reason: string }[] }).unchanged;
      if (unchanged?.length) setError(unchanged[0]?.reason || "Klaviyo returned no results yet.");
      await onChange(campaign.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Klaviyo did not return results.");
    } finally {
      setPending("");
    }
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaign) return;
    const form = event.currentTarget;
    const input = form.elements.namedItem("file");
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) {
      setError("Choose a PNG, JPG, WebP, or HTML file.");
      return;
    }
    setPending("upload");
    setError(null);
    try {
      const body = new FormData();
      body.set("file", input.files[0]);
      const response = await fetch(`/api/retention/calendar/campaigns/${campaign.id}/designs`, { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "That design was not saved.");
      form.reset();
      await onChange(campaign.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That design was not saved.");
    } finally {
      setPending("");
    }
  }

  async function removeDesign(id: string) {
    if (!campaign) return;
    setPending("design");
    setError(null);
    try {
      await sendJson(`/api/retention/calendar/designs/${id}`, "DELETE");
      await onChange(campaign.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That design was not deleted.");
    } finally {
      setPending("");
    }
  }

  async function review(verdict: "comment" | "approved" | "changes_requested", status?: Status) {
    if (!campaign) return;
    setPending("review");
    setError(null);
    try {
      await sendJson(`/api/retention/calendar/campaigns/${campaign.id}/reviews`, "POST", {
        author,
        body: comment,
        verdict,
        ...(status ? { status } : {}),
      });
      setComment("");
      await onChange(campaign.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That comment was not saved.");
    } finally {
      setPending("");
    }
  }

  async function removeReview(id: string) {
    if (!campaign) return;
    setPending("review");
    setError(null);
    try {
      await sendJson(`/api/retention/calendar/reviews/${id}`, "DELETE");
      await onChange(campaign.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That comment was not deleted.");
    } finally {
      setPending("");
    }
  }

  async function removeCampaign() {
    if (!campaign) return;
    setPending("delete");
    setError(null);
    try {
      await sendJson(`/api/retention/calendar/campaigns/${campaign.id}`, "DELETE");
      await onChange();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That send was not deleted.");
      setPending("");
    }
  }

  const latest = campaign?.reviews[campaign.reviews.length - 1];
  const clock = campaign ? formatClock(campaign.sendTime, campaign.timeLabel) : "";

  return (
    <div className="cal-drawer">
      <button className="cal-scrim" type="button" aria-label="Close details" onClick={onClose} />
      <div className="cal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="cal-panel-head">
          <div>
            <p className="eyebrow">{campaign ? CHANNEL_LABEL[campaign.channel] : "New send"}</p>
            <h2 id={titleId}>{campaign ? campaign.title : "Add a send"}</h2>
          </div>
          <button ref={closeRef} className="btn ghost sm" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {campaign ? (
          <div className="row">
            <span className={`cal-pill is-${campaign.status}`}>{STATUS_LABEL[campaign.status]}</span>
            {latest && latest.verdict !== "comment" ? <span className={`cal-pill is-${latest.verdict}`}>{VERDICT_LABEL[latest.verdict]}</span> : null}
          </div>
        ) : null}
        {error ? <p className="error">{error}</p> : null}

        {campaign ? (
          <section className="cal-section">
            <h3>How it&apos;s set up</h3>
            <dl className="cal-facts">
              <div>
                <dt>Status</dt>
                <dd>{STATUS_LABEL[campaign.status]}</dd>
              </div>
              <div>
                <dt>Send</dt>
                <dd>
                  {campaign.sendDate} · {clock}
                  {campaign.sendTime ? ` (${campaign.sendTime})` : ""} · Europe/London
                </dd>
              </div>
              <div>
                <dt>Channel</dt>
                <dd>{CHANNEL_LABEL[campaign.channel]}</dd>
              </div>
              <div>
                <dt>Subject</dt>
                <dd>{campaign.subject || "—"}</dd>
              </div>
              <div>
                <dt>Preview</dt>
                <dd>{campaign.previewText || "—"}</dd>
              </div>
              <div>
                <dt>Audience</dt>
                <dd>
                  {campaign.audience || "—"}
                  {campaign.audienceSize !== null ? ` About ${formatCount(campaign.audienceSize)} people.` : ""}
                </dd>
              </div>
              <div>
                <dt>Smart Sending</dt>
                <dd>{smartLabel(campaign.smartSending)}</dd>
              </div>
              <div>
                <dt>Offer code</dt>
                <dd>{campaign.offerCode || "—"}</dd>
              </div>
              <div>
                <dt>Klaviyo</dt>
                <dd>
                  {campaign.klaviyoUrl ? (
                    <a href={campaign.klaviyoUrl} target="_blank" rel="noreferrer">
                      {campaign.klaviyoCampaignId}
                    </a>
                  ) : (
                    "Not linked yet"
                  )}
                </dd>
              </div>
            </dl>
            {campaign.notes ? <p className="cal-notes">{campaign.notes}</p> : null}
          </section>
        ) : null}

        <form className="cal-section" onSubmit={saveSetup}>
          <h3>{campaign ? "Edit this send" : "Details"}</h3>
          <label className="field">
            Name
            <input value={draft.title} onChange={(event) => setField("title", event.target.value)} maxLength={180} required />
          </label>
          <div className="cal-form-grid">
            <label className="field">
              Status
              <select value={draft.status} onChange={(event) => setField("status", event.target.value as Status)}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Channel
              <select value={draft.channel} onChange={(event) => setField("channel", event.target.value as Channel)}>
                {CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {CHANNEL_LABEL[channel]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Send date
              <input type="date" value={draft.sendDate} onChange={(event) => setField("sendDate", event.target.value)} required />
            </label>
            <label className="field">
              Time, Europe/London
              <input value={draft.sendTime} onChange={(event) => setField("sendTime", event.target.value)} placeholder="19:30" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" />
            </label>
            <label className="field">
              Time label
              <input value={draft.timeLabel} onChange={(event) => setField("timeLabel", event.target.value)} placeholder="Daytime" maxLength={40} />
            </label>
            <label className="field">
              Smart Sending
              <select value={draft.smartSending} onChange={(event) => setField("smartSending", event.target.value as Draft["smartSending"])}>
                <option value="">Not set</option>
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            </label>
          </div>
          <label className="field">
            Subject
            <input value={draft.subject} onChange={(event) => setField("subject", event.target.value)} maxLength={300} />
          </label>
          <label className="field">
            Preview text
            <textarea value={draft.previewText} onChange={(event) => setField("previewText", event.target.value)} rows={2} maxLength={500} />
          </label>
          <label className="field">
            Audience
            <textarea value={draft.audience} onChange={(event) => setField("audience", event.target.value)} rows={2} maxLength={2000} />
          </label>
          <div className="cal-form-grid">
            <label className="field">
              Audience size
              <input value={draft.audienceSize} onChange={(event) => setField("audienceSize", event.target.value)} inputMode="numeric" />
            </label>
            <label className="field">
              Offer code
              <input value={draft.offerCode} onChange={(event) => setField("offerCode", event.target.value)} maxLength={40} />
            </label>
            <label className="field">
              Klaviyo campaign ID
              <input value={draft.klaviyoCampaignId} onChange={(event) => setField("klaviyoCampaignId", event.target.value)} maxLength={32} />
            </label>
          </div>
          <label className="field">
            Card note
            <input value={draft.cardNote} onChange={(event) => setField("cardNote", event.target.value)} maxLength={400} />
          </label>
          <label className="field">
            Strategy notes
            <textarea value={draft.notes} onChange={(event) => setField("notes", event.target.value)} rows={5} maxLength={8000} />
          </label>
          <button className="btn" type="submit" disabled={pending === "setup"}>
            {pending === "setup" ? "Saving…" : campaign ? "Save send" : "Add send"}
          </button>
        </form>

        {campaign && results ? (
          <section className="cal-section">
            <div className="subhead">
              <h3>Results and attribution</h3>
              <button className="btn ghost sm" type="button" onClick={syncOne} disabled={pending === "sync" || !campaign.klaviyoCampaignId}>
                {pending === "sync" ? "Syncing…" : "Sync from Klaviyo"}
              </button>
            </div>
            <p className="muted small">
              {campaign.results.source === "klaviyo" && campaign.results.syncedAt
                ? `Klaviyo, synced ${formatLondon(new Date(campaign.results.syncedAt))}.`
                : campaign.results.source === "manual"
                  ? "Manual snapshot."
                  : "No live results stored yet."}{" "}
              {campaign.klaviyoCampaignId
                ? klaviyoConnected
                  ? "A sync replaces these figures with Klaviyo. Leave the campaign ID blank to keep a snapshot."
                  : "Klaviyo is not connected, so the stored snapshot is shown."
                : "Add a Klaviyo campaign ID to pull live results. Until then, the snapshot below is what the calendar shows."}
            </p>
            {campaign.results.error ? <p className="warn-copy">{campaign.results.error}</p> : null}
            <div className="cal-metrics">
              <Metric label="Revenue" value={campaign.results.revenuePence === null ? null : formatMoneyPence(campaign.results.revenuePence, campaign.results.currency)} />
              <Metric label="Orders" value={formatCount(campaign.results.orders)} />
              <Metric label="Average order" value={campaign.results.aovPence === null ? null : formatMoneyPence(campaign.results.aovPence, campaign.results.currency)} />
              <Metric label="Open rate" value={formatCalendarRate(campaign.results.openRate)} />
              <Metric label="Opens" value={formatCount(campaign.results.opens)} />
              <Metric label="Click rate" value={formatCalendarRate(campaign.results.clickRate)} />
              <Metric label="Clicks" value={formatCount(campaign.results.clicks)} />
              <Metric label="Recipients" value={formatCount(campaign.results.recipients)} />
              <Metric label="Delivered" value={formatCount(campaign.results.delivered)} />
              <Metric label="Conversion" value={formatCalendarRate(campaign.results.conversionRate)} />
              <Metric label="Unsubscribe rate" value={formatCalendarRate(campaign.results.unsubscribeRate)} />
              <Metric label="Unsubscribes" value={formatCount(campaign.results.unsubscribes)} />
              <Metric label="Bounce rate" value={formatCalendarRate(campaign.results.bounceRate)} />
              <Metric label="Bounces" value={formatCount(campaign.results.bounces)} />
              <Metric label="Spam rate" value={formatCalendarRate(campaign.results.spamRate)} />
              <Metric label="Spam complaints" value={formatCount(campaign.results.spamComplaints)} />
            </div>
            <p className="cal-notes">
              {campaign.results.attributionModel ? <b>{campaign.results.attributionModel}. </b> : null}
              {campaign.results.attributionDetail || (campaign.klaviyoCampaignId ? KLAVIYO_ATTRIBUTION_DETAIL : "")}
            </p>
            <form onSubmit={saveResults}>
              <h3>Edit the stored snapshot</h3>
              <p className="muted small">Percentages are out of 100. Money is pounds. Blank clears a figure. Saving marks this as a manual snapshot.</p>
              <div className="cal-form-grid">
                {(
                  [
                    ["openRate", "Open rate %"],
                    ["clickRate", "Click rate %"],
                    ["revenue", "Revenue £"],
                    ["orders", "Orders"],
                    ["recipients", "Recipients"],
                    ["delivered", "Delivered"],
                    ["opens", "Opens"],
                    ["clicks", "Clicks"],
                    ["conversionRate", "Conversion %"],
                    ["aov", "Average order £"],
                    ["unsubscribes", "Unsubscribes"],
                    ["unsubscribeRate", "Unsubscribe %"],
                    ["bounces", "Bounces"],
                    ["bounceRate", "Bounce %"],
                    ["spamComplaints", "Spam complaints"],
                    ["spamRate", "Spam %"],
                  ] as const
                ).map(([key, label]) => (
                  <label className="field" key={key}>
                    {label}
                    <input value={results[key]} onChange={(event) => setResults({ ...results, [key]: event.target.value })} inputMode="decimal" />
                  </label>
                ))}
              </div>
              <label className="field">
                Attribution model
                <input value={results.attributionModel} onChange={(event) => setResults({ ...results, attributionModel: event.target.value })} maxLength={200} placeholder="Last touch, 5-day email" />
              </label>
              <button className="btn" type="submit" disabled={pending === "results"}>
                {pending === "results" ? "Saving…" : "Save snapshot"}
              </button>
            </form>
          </section>
        ) : null}

        {campaign ? (
          <section className="cal-section">
            <h3>Designs</h3>
            {campaign.designs.length ? (
              <div className="cal-designs">
                {campaign.designs.map((design) => (
                  <figure key={design.id}>
                    {design.mimeType.startsWith("image/") ? (
                      <img src={`/api/retention/calendar/designs/${design.id}`} alt={design.filename} />
                    ) : html[design.id] ? (
                      <iframe title={design.filename} sandbox="" srcDoc={html[design.id]} />
                    ) : (
                      <p className="muted">Loading preview…</p>
                    )}
                    <figcaption>
                      <span>
                        {design.filename} · {design.uploadedBy} · {formatLondon(new Date(design.createdAt))}
                      </span>
                      <button className="subtle" type="button" onClick={() => removeDesign(design.id)}>
                        Remove
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="muted">No design uploaded yet.</p>
            )}
            <form onSubmit={upload}>
              <label className="field">
                Upload a PNG, JPG, WebP, or HTML file
                <input name="file" type="file" accept="image/png,image/jpeg,image/webp,text/html,.html,.htm,.png,.jpg,.jpeg,.webp" />
              </label>
              <button className="btn" type="submit" disabled={pending === "upload"}>
                {pending === "upload" ? "Uploading…" : "Upload design"}
              </button>
            </form>
          </section>
        ) : null}

        {campaign ? (
          <section className="cal-section">
            <h3>Team review</h3>
            {campaign.reviews.length ? (
              <ul className="cal-reviews">
                {campaign.reviews.map((review) => (
                  <li key={review.id}>
                    <header>
                      <b>{review.author}</b>
                      <span className={`cal-pill is-${review.verdict}`}>{VERDICT_LABEL[review.verdict]}</span>
                      <span className="muted small">{formatLondon(new Date(review.createdAt))}</span>
                      <button className="subtle" type="button" onClick={() => removeReview(review.id)}>
                        Delete
                      </button>
                    </header>
                    {review.body ? <p>{review.body}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No comments yet.</p>
            )}
            <label className="field">
              From
              <input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={40} />
            </label>
            <label className="field">
              Comment
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={4000} placeholder="What should change, or what is good" />
            </label>
            <div className="row">
              <button className="btn ghost sm" type="button" disabled={pending === "review"} onClick={() => review("comment")}>
                Comment
              </button>
              <button className="btn ghost sm" type="button" disabled={pending === "review"} onClick={() => review("changes_requested", "built")}>
                Request changes
              </button>
              <button className="btn sm" type="button" disabled={pending === "review"} onClick={() => review("approved", "scheduled")}>
                Approve and schedule
              </button>
            </div>
            <p className="muted small">Request changes sets the status to Built, needs your OK. Approve and schedule sets it to Scheduled.</p>
          </section>
        ) : null}

        {campaign ? (
          <section className="cal-section">
            {confirmDelete ? <p className="warn-copy">This removes the send, its designs, and its review comments.</p> : null}
            <button className={confirmDelete ? "btn danger" : "btn ghost"} type="button" disabled={pending === "delete"} onClick={() => (confirmDelete ? removeCampaign() : setConfirmDelete(true))}>
              {pending === "delete" ? "Deleting…" : confirmDelete ? "Delete this send" : "Delete"}
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <article className="cal-metric">
      <span>{label}</span>
      <b className={value ? "" : "is-empty"}>{value ?? "—"}</b>
    </article>
  );
}
