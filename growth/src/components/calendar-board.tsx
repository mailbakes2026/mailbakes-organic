"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addMonths, mondayOf } from "@/lib/dates";
import { formatCount } from "@/lib/format";
import { CampaignPanel } from "@/components/campaign-panel";
import {
  STATUS_LABEL,
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
type FilterId = "all" | "sent" | "scheduled" | "built" | "needs" | "draft" | "skipped" | "task";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "scheduled", label: "Scheduled" },
  { id: "built", label: "Built" },
  { id: "needs", label: "Needs OK" },
  { id: "draft", label: "Draft" },
];

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

function matches(campaign: CampaignJson, filter: FilterId) {
  if (filter === "all") return true;
  if (filter === "sent") return campaign.status === "sent";
  if (filter === "scheduled") return campaign.status === "scheduled";
  if (filter === "built") return campaign.designs.length > 0;
  if (filter === "needs") return campaign.status === "built";
  if (filter === "draft") return campaign.status === "planned";
  if (filter === "skipped") return campaign.status === "skipped";
  if (filter === "task") return campaign.status === "task";
  return true;
}

function monthHref(month: string) {
  return `?view=month&month=${month}`;
}

function weekHref(week: string) {
  return `?view=week&week=${week}`;
}

export function CalendarBoard({
  initial,
  actor,
  initialCampaign,
  view,
  month,
  monthLabel,
}: {
  initial: WeekJson;
  actor: string;
  initialCampaign?: string;
  view: "month" | "week";
  month: string;
  monthLabel: string;
}) {
  const router = useRouter();
  const [week, setWeek] = useState(initial);
  const [panel, setPanel] = useState<{ campaign: CampaignJson | null; date: string } | null>(null);
  const [offer, setOffer] = useState<OfferDraft | null>(null);
  const [tagFor, setTagFor] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
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

  const focused = week.days.flatMap((day) => day.campaigns).filter((campaign) => view === "week" || campaign.sendDate.startsWith(month));
  const counts = {
    all: focused.length,
    sent: focused.filter((campaign) => campaign.status === "sent").length,
    scheduled: focused.filter((campaign) => campaign.status === "scheduled").length,
    built: focused.filter((campaign) => campaign.designs.length > 0).length,
    needs: focused.filter((campaign) => campaign.status === "built").length,
    draft: focused.filter((campaign) => campaign.status === "planned").length,
    skipped: focused.filter((campaign) => campaign.status === "skipped").length,
    task: focused.filter((campaign) => campaign.status === "task").length,
  };
  const extraFilters = (["skipped", "task"] as const).filter((id) => counts[id] > 0).map((id) => ({ id, label: STATUS_LABEL[id] }));
  const previous = view === "month" ? monthHref(addMonths(month, -1)) : weekHref(addDays(week.from, -7));
  const next = view === "month" ? monthHref(addMonths(month, 1)) : weekHref(addDays(week.from, 7));
  const rangeLabel = view === "month" ? monthLabel : week.rangeLabel;

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
    const response = await fetch(`/api/retention/calendar?from=${week.from}&to=${week.to}`, { cache: "no-store" });
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
      const data = await sendJson("/api/retention/calendar/sync", "POST", { from: week.from, to: week.to });
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
  const needsOk = focused.filter((campaign) => campaign.status === "built");
  const weeks = chunk(week.days, 7);

  return (
    <>
      <div className="page-head">
        <div className="page-head-copy">
          <h1>Calendar</h1>
          <p className="lede">Every planned email and offer, for the month or the week. Planned days stay proposals until you OK them.</p>
          <p className="metric-line">
            <b>{focused.length}</b> {focused.length === 1 ? "send" : "sends"}
            <span className="metric-sep"> · </span>
            {needsOk.length ? (
              <>
                <b className="is-alert">{needsOk.length}</b> need your OK
              </>
            ) : (
              <b className="is-good">All done</b>
            )}
          </p>
        </div>
        <div className="head-actions">
          <div className="view-toggle" role="group" aria-label="Calendar view">
            <a className={view === "month" ? "active" : ""} href={monthHref(month)} aria-current={view === "month" ? "page" : undefined}>
              Month
            </a>
            <a className={view === "week" ? "active" : ""} href={weekHref(week.from)} aria-current={view === "week" ? "page" : undefined}>
              Week
            </a>
          </div>
          <button className="btn" type="button" onClick={syncWeek} disabled={pending === "sync" || !week.klaviyoConnected}>
            {pending === "sync" ? "Refreshing…" : "Refresh results"}
          </button>
          <button className="btn ghost" type="button" onClick={() => setPanel({ campaign: null, date: week.today >= week.from && week.today <= week.to ? week.today : week.from })}>
            Add send
          </button>
          <div className="stepper">
            <a className="stepper-btn" href={previous} aria-label={view === "month" ? "Previous month" : "Previous week"}>
              ←
            </a>
            <span className="stepper-label">{rangeLabel}</span>
            <a className="stepper-btn" href={next} aria-label={view === "month" ? "Next month" : "Next week"}>
              →
            </a>
          </div>
        </div>
      </div>

      {needsOk.length ? (
        <p className="callout">
          <b>{needsOk.length === 1 ? "1 send needs Millie's OK" : `${needsOk.length} sends need Millie's OK`}</b>{" "}
          {needsOk
            .slice(0, 4)
            .map((campaign) => campaign.title)
            .join(", ")}
          {needsOk.length > 4 ? ` and ${needsOk.length - 4} more` : ""}. Review the built emails before they go out.
        </p>
      ) : null}
      {week.klaviyoConnected ? null : (
        <p className="callout">
          <b>Klaviyo is not connected.</b> Results stay on the stored snapshot until KLAVIYO_PRIVATE_API_KEY or KLAVIYO_PRIVATE_KEY is set.
        </p>
      )}
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      <div className="cal-jump">
        {view === "month" && month !== week.today.slice(0, 7) ? (
          <a className="btn ghost sm" href={monthHref(week.today.slice(0, 7))}>
            This month
          </a>
        ) : null}
        {view === "week" && mondayOf(week.today) !== week.from ? (
          <a className="btn ghost sm" href={weekHref(week.today)}>
            This week
          </a>
        ) : null}
        {view === "week" && week.from !== "2026-11-23" ? (
          <a className="btn ghost sm" href={weekHref("2026-11-23")}>
            Black Friday week
          </a>
        ) : null}
        {view === "month" && month !== "2026-11" ? (
          <a className="btn ghost sm" href={monthHref("2026-11")}>
            Black Friday month
          </a>
        ) : null}
        <form
          className="jump-week"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("jump");
            if (typeof value !== "string" || !value) return;
            window.location.href = view === "month" ? monthHref(value.slice(0, 7)) : weekHref(value);
          }}
        >
          <input
            type="date"
            name="jump"
            defaultValue={view === "month" ? `${month}-01` : week.from}
            aria-label={view === "month" ? "Jump to a month" : "Jump to a week"}
            onChange={(event) => {
              if (!event.target.value) return;
              window.location.href = view === "month" ? monthHref(event.target.value.slice(0, 7)) : weekHref(event.target.value);
            }}
          />
        </form>
        <button className="btn ghost sm" type="button" onClick={() => setOffer({ label: "", startDate: week.from, endDate: week.to, tone: "pink" })}>
          Add offer
        </button>
      </div>

      <div className="filter-pills" role="group" aria-label="Filter sends">
        {[...FILTERS, ...extraFilters].map((item) => (
          <button key={item.id} type="button" className={filter === item.id ? "active" : ""} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
            {item.label}
            <span>{counts[item.id]}</span>
          </button>
        ))}
      </div>

      <section className="summary-grid" aria-label={view === "month" ? monthLabel : "This week"}>
        <Summary label="Sends" value={String(focused.length)} hint={rangeLabel} />
        <Summary label="Needs OK" value={needsOk.length ? String(needsOk.length) : "All done"} hint={needsOk.length ? "Built, waiting on Millie" : "Nothing waiting"} done={!needsOk.length} />
        <Summary label="Built" value={String(counts.built)} hint="Have a design" />
        <Summary
          label="Revenue"
          value={rollup.mixedCurrency ? "Mixed" : rollup.revenuePence === null ? "—" : formatMoneyPence(rollup.revenuePence, rollup.currency)}
          hint={rollup.orders === null ? "Orders not stored" : `${formatCount(rollup.orders)} orders`}
          empty={rollup.revenuePence === null || rollup.mixedCurrency}
        />
      </section>

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

      {view === "month" ? (
        <div className="cal-month-scroll">
          <div className="cal-month">
            <div className="cal-span" aria-hidden="true">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            {weeks.map((days) => (
              <div className="cal-month-block" key={days[0]?.date}>
                <div className="cal-offers">
                  {week.offers.map((item) => {
                    const span = offerSpan(item, days[0]?.date ?? week.from, days[days.length - 1]?.date ?? week.to);
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
                <div className="cal-month-week">
                  {days.map((day) => (
                    <section key={day.date} className={`cal-cell${day.date === week.today ? " is-today" : ""}${day.date.startsWith(month) ? "" : " is-outside"}`}>
                      <header>
                        <button className="cal-date" type="button" onClick={() => setPanel({ campaign: null, date: day.date })}>
                          <b>{day.day}</b>
                          <span>{day.month}</span>
                        </button>
                        {day.tags.map((tag) => (
                          <span key={tag.id} className="cal-tag">
                            {tag.label}
                            <button type="button" aria-label={`Remove ${tag.label}`} onClick={() => removeTag(tag.id)}>
                              ×
                            </button>
                          </span>
                        ))}
                      </header>
                      {day.campaigns.filter((campaign) => matches(campaign, filter)).map((campaign) => (
                        <SendButton key={campaign.id} campaign={campaign} compact onOpen={() => openCampaign(campaign)} />
                      ))}
                      <button className="subtle cal-add" type="button" onClick={() => setPanel({ campaign: null, date: day.date })}>
                        Add
                      </button>
                    </section>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <section className="cal-week" aria-label={week.title}>
          <div className="cal-week-scroll">
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
          </div>
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
                {day.campaigns.filter((campaign) => matches(campaign, filter)).map((campaign) => (
                  <SendButton key={campaign.id} campaign={campaign} onOpen={() => openCampaign(campaign)} />
                ))}
                <button className="subtle cal-add" type="button" onClick={() => setPanel({ campaign: null, date: day.date })}>
                  Add on this day
                </button>
              </section>
            ))}
          </div>
        </section>
      )}
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
    </>
  );
}

function Summary({ label, value, hint, done, empty }: { label: string; value: string; hint: string; done?: boolean; empty?: boolean }) {
  return (
    <article className="stat">
      <span className="eyebrow">{label}</span>
      <b className={`stat-num${done ? " is-done" : ""}${empty ? " is-empty" : ""}`}>{value}</b>
      <span className="muted small">{hint}</span>
    </article>
  );
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function SendButton({ campaign, onOpen, compact }: { campaign: CampaignJson; onOpen: () => void; compact?: boolean }) {
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
    <button type="button" className={`cal-send is-${status}${compact ? " is-compact" : ""}`} onClick={onOpen}>
      {image ? (
        <img className="cal-thumb" src={`/api/retention/calendar/designs/${image.id}`} alt="" />
      ) : html ? (
        <span className="cal-html">HTML</span>
      ) : (
        <span className="cal-thumb cal-placeholder" aria-hidden="true">
          {campaign.channel === "sms" ? "SMS" : "Email"}
        </span>
      )}
      <span>
        <span className="cal-send-title">
          {when} · {campaign.title}
        </span>
        <span className={`cal-pill is-${status}`}>{STATUS_LABEL[status]}</span>
        {campaign.designs.length ? <span className="cal-pill is-built">Built</span> : null}
        {line && !compact ? <span className="cal-send-note">{line}</span> : null}
      </span>
    </button>
  );
}
