"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, mondayOf } from "@/lib/dates";
import { formatCount } from "@/lib/format";
import { CampaignPanel } from "@/components/campaign-panel";
import {
  STATUS_LABEL,
  STATUSES,
  formatCalendarRate,
  formatClock,
  formatMoneyPence,
  offerSpan,
  resultsLine,
  type CampaignJson,
  type Status,
  type Tone,
  type WeekJson,
} from "@/lib/retention/calendar/model";

type OfferDraft = { id?: string; label: string; startDate: string; endDate: string; tone: Tone };

async function sendJson(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "That was not saved.");
  return data;
}

export function CalendarBoard({ initial, actor, initialCampaign }: { initial: WeekJson; actor: string; initialCampaign?: string }) {
  const router = useRouter();
  const [week, setWeek] = useState(initial);
  const [panel, setPanel] = useState<{ campaign: CampaignJson | null; date: string } | null>(null);
  const [offer, setOffer] = useState<OfferDraft | null>(null);
  const [tagFor, setTagFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState("");

  useEffect(() => {
    setWeek(initial);
  }, [initial]);

  useEffect(() => {
    if (!initialCampaign) return;
    const found = initial.days.flatMap((day) => day.campaigns).find((campaign) => campaign.id === initialCampaign);
    if (found) setPanel({ campaign: found, date: found.sendDate });
    // Open the linked send once. Later refreshes keep whatever the user is editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCampaign]);

  const campaigns = week.days.flatMap((day) => day.campaigns);
  const previous = addDays(week.from, -7);
  const next = addDays(week.from, 7);

  function openCampaign(campaign: CampaignJson) {
    setPanel({ campaign, date: campaign.sendDate });
    const url = new URL(window.location.href);
    url.searchParams.set("campaign", campaign.id);
    window.history.replaceState(null, "", url);
  }

  function closePanel() {
    setPanel(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("campaign");
    window.history.replaceState(null, "", url);
  }

  async function refresh(nextId?: string) {
    router.refresh();
    const response = await fetch(`/api/retention/calendar?week=${week.from}`, { cache: "no-store" });
    const data = (await response.json()) as WeekJson & { error?: string };
    if (!response.ok) throw new Error(data.error || "The calendar could not be refreshed.");
    setWeek(data);
    if (nextId) {
      const found = data.days.flatMap((day) => day.campaigns).find((campaign) => campaign.id === nextId);
      if (found) setPanel({ campaign: found, date: found.sendDate });
    } else if (panel?.campaign) {
      const found = data.days.flatMap((day) => day.campaigns).find((campaign) => campaign.id === panel.campaign?.id);
      setPanel(found ? { campaign: found, date: found.sendDate } : panel.campaign ? null : panel);
    }
  }

  async function syncWeek() {
    setPending("sync");
    setError(null);
    setNotice(null);
    try {
      const data = await sendJson("/api/retention/calendar/sync", "POST", { week: week.from });
      const updated = (data as { updated?: string[] }).updated?.length ?? 0;
      const unchanged = (data as { unchanged?: unknown[] }).unchanged?.length ?? 0;
      const message = (data as { message?: string }).message;
      setNotice(message || `Synced ${updated}. ${unchanged} left on the stored snapshot.`);
      await refresh(panel?.campaign?.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Klaviyo did not return results.");
    } finally {
      setPending("");
    }
  }

  async function saveOffer(event: React.FormEvent) {
    event.preventDefault();
    if (!offer) return;
    setPending("offer");
    setError(null);
    try {
      if (offer.id) await sendJson(`/api/retention/calendar/offers/${offer.id}`, "PATCH", offer);
      else await sendJson("/api/retention/calendar/offers", "POST", offer);
      setOffer(null);
      await refresh(panel?.campaign?.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That offer was not saved.");
    } finally {
      setPending("");
    }
  }

  async function removeOffer() {
    if (!offer?.id) return;
    setPending("offer");
    setError(null);
    try {
      await sendJson(`/api/retention/calendar/offers/${offer.id}`, "DELETE");
      setOffer(null);
      await refresh(panel?.campaign?.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That offer was not deleted.");
    } finally {
      setPending("");
    }
  }

  async function addTag(event: React.FormEvent<HTMLFormElement>, date: string) {
    event.preventDefault();
    const label = String(new FormData(event.currentTarget).get("label") || "");
    setPending("tag");
    setError(null);
    try {
      await sendJson("/api/retention/calendar/tags", "POST", { date, label });
      setTagFor(null);
      await refresh(panel?.campaign?.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That tag was not saved.");
    } finally {
      setPending("");
    }
  }

  async function removeTag(id: string) {
    setError(null);
    try {
      await sendJson(`/api/retention/calendar/tags/${id}`, "DELETE");
      await refresh(panel?.campaign?.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That tag was not deleted.");
    }
  }

  const rollup = week.rollup;
  const rollupBits = [
    rollup.mixedCurrency ? "Mixed currencies" : rollup.revenuePence === null ? null : formatMoneyPence(rollup.revenuePence, rollup.currency),
    rollup.orders === null ? null : `${formatCount(rollup.orders)} orders`,
    formatCalendarRate(rollup.openRate) ? `${formatCalendarRate(rollup.openRate)} open` : null,
    formatCalendarRate(rollup.clickRate) ? `${formatCalendarRate(rollup.clickRate)} click` : null,
  ].filter(Boolean);

  return (
    <>
      <div className="cal-toolbar">
        <div className="row">
          <a className="btn ghost sm" href={`?week=${previous}`}>
            Previous
          </a>
          <a className="btn ghost sm" href={`?week=${next}`}>
            Next
          </a>
          {mondayOf(week.today) !== week.from ? (
            <a className="btn ghost sm" href={`?week=${week.today}`}>
              This week
            </a>
          ) : null}
          {week.from !== "2026-11-23" ? (
            <a className="btn ghost sm" href="?week=2026-11-23">
              Black Friday week
            </a>
          ) : null}
        </div>
        <form
          className="row"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("jump");
            if (typeof value === "string" && value) window.location.href = `?week=${value}`;
          }}
        >
          <input type="date" name="jump" defaultValue={week.from} aria-label="Jump to a week" />
          <button className="btn ghost sm" type="submit">
            Go
          </button>
        </form>
      </div>

      <ul className="cal-legend">
        {STATUSES.map((status) => (
          <li key={status}>
            <i className={`cal-swatch is-${status}`} />
            {STATUS_LABEL[status]}
          </li>
        ))}
      </ul>

      <section className="cal-week" aria-label={week.title}>
        <header className="cal-week-head">
          <h2>{week.title}</h2>
          <span>{week.rangeLabel}</span>
        </header>
        <p className="cal-rollup">
          {rollup.counted ? (
            <>
              This week · {rollupBits.join(" · ")}
              <span className="muted"> · {rollup.counted} with results</span>
            </>
          ) : (
            <span className="muted">No results stored for this week yet.</span>
          )}
        </p>
        <div className="cal-span" aria-hidden="true">
          {week.days.map((day) => (
            <span key={day.date} className={day.date === week.today ? "is-today" : ""}>
              {day.weekday} {day.day}
            </span>
          ))}
        </div>
        <div className="cal-offers">
          {week.offers.map((item) => {
            const span = offerSpan(item, week.from, week.to);
            if (!span) return null;
            return (
              <button
                key={item.id}
                type="button"
                className={`cal-offer is-${item.tone}`}
                style={{ gridColumn: `${span.startIndex + 1} / span ${span.span}` }}
                title={`${item.label}, ${item.startDate} to ${item.endDate}`}
                onClick={() => setOffer({ id: item.id, label: item.label, startDate: item.startDate, endDate: item.endDate, tone: item.tone })}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="row">
          <button className="btn sm" type="button" onClick={() => setPanel({ campaign: null, date: week.today >= week.from && week.today <= week.to ? week.today : week.from })}>
            Add send
          </button>
          <button className="btn ghost sm" type="button" onClick={() => setOffer({ label: "", startDate: week.from, endDate: week.to, tone: "pink" })}>
            Add offer
          </button>
          <button className="btn ghost sm" type="button" onClick={syncWeek} disabled={pending === "sync"}>
            {pending === "sync" ? "Syncing…" : "Sync Klaviyo results"}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="muted">{notice}</p> : null}

        {offer ? (
          <form className="card cal-offer-form" onSubmit={saveOffer}>
            <h3>{offer.id ? "Edit offer" : "New offer"}</h3>
            <label className="field">
              Label
              <input value={offer.label} onChange={(event) => setOffer({ ...offer, label: event.target.value })} maxLength={120} required />
            </label>
            <div className="cal-form-grid">
              <label className="field">
                Starts
                <input type="date" value={offer.startDate} onChange={(event) => setOffer({ ...offer, startDate: event.target.value })} required />
              </label>
              <label className="field">
                Ends
                <input type="date" value={offer.endDate} onChange={(event) => setOffer({ ...offer, endDate: event.target.value })} required />
              </label>
              <label className="field">
                Colour
                <select value={offer.tone} onChange={(event) => setOffer({ ...offer, tone: event.target.value as Tone })}>
                  <option value="pink">Pink</option>
                  <option value="plum">Plum</option>
                </select>
              </label>
            </div>
            <div className="row">
              <button className="btn sm" type="submit" disabled={pending === "offer"}>
                {pending === "offer" ? "Saving…" : "Save offer"}
              </button>
              {offer.id ? (
                <button className="btn ghost sm" type="button" onClick={removeOffer}>
                  Delete offer
                </button>
              ) : null}
              <button className="btn ghost sm" type="button" onClick={() => setOffer(null)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="cal-days">
          {week.days.map((day) => (
            <section key={day.date} className={`cal-day${day.date === week.today ? " is-today" : ""}`}>
              <header>
                <div>
                  <b>{day.day}</b>
                  <span>
                    {day.weekday} {day.month}
                  </span>
                </div>
                <div className="cal-day-marks">
                  {day.date === week.today ? <span className="cal-today">Today</span> : null}
                  {day.tags.map((tag) => (
                    <span key={tag.id} className="cal-tag">
                      {tag.label}
                      <button type="button" aria-label={`Remove ${tag.label}`} onClick={() => removeTag(tag.id)}>
                        ×
                      </button>
                    </span>
                  ))}
                  {tagFor === day.date ? (
                    <form onSubmit={(event) => addTag(event, day.date)}>
                      <input name="label" aria-label={`Tag for ${day.date}`} maxLength={40} placeholder="Christmas" required />
                      <button className="btn sm" type="submit">
                        Add
                      </button>
                    </form>
                  ) : (
                    <button className="subtle" type="button" onClick={() => setTagFor(day.date)}>
                      Add tag
                    </button>
                  )}
                </div>
              </header>
              {day.campaigns.map((campaign) => (
                <SendButton key={campaign.id} campaign={campaign} onOpen={() => openCampaign(campaign)} />
              ))}
              <button className="subtle cal-add" type="button" onClick={() => setPanel({ campaign: null, date: day.date })}>
                Add on this day
              </button>
            </section>
          ))}
        </div>
      </section>
      {panel ? (
        <CampaignPanel
          campaign={panel.campaign}
          defaultDate={panel.date}
          actor={actor}
          klaviyoConnected={week.klaviyoConnected}
          onClose={closePanel}
          onChange={refresh}
        />
      ) : null}
      <p className="muted small cal-count">{campaigns.length} sends this week</p>
    </>
  );
}

function SendButton({ campaign, onOpen }: { campaign: CampaignJson; onOpen: () => void }) {
  const status = campaign.status as Status;
  const line = resultsLine({
    openRate: campaign.results.openRate,
    clickRate: campaign.results.clickRate,
    revenuePence: campaign.results.revenuePence,
    orders: campaign.results.orders,
    currency: campaign.results.currency,
    cardNote: campaign.cardNote,
  });
  const image = campaign.designs.find((design) => design.mimeType.startsWith("image/"));
  const html = campaign.designs.find((design) => design.mimeType === "text/html");
  const when = formatClock(campaign.sendTime, campaign.timeLabel);
  return (
    <button type="button" className={`cal-send is-${status}`} onClick={onOpen}>
      {image ? <img className="cal-thumb" src={`/api/retention/calendar/designs/${image.id}`} alt="" /> : html ? <span className="cal-html">HTML</span> : null}
      <span>
        <span className="cal-send-title">
          {when} · {campaign.title}
        </span>
        {line ? <span className="cal-send-note">{line}</span> : null}
      </span>
    </button>
  );
}
