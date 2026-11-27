import { WeekDelta } from "@/components/week-delta";
import { formatCount, formatMoney, formatRate } from "@/lib/format";
import { flowIconKind, klaviyoFlowUrl, type FlowCardModel, type FlowIconKind } from "@/lib/retention/attention";

const ICONS: Record<FlowIconKind, string> = {
  cart: '<path d="M6 7h15l-1.5 9h-12z"/><path d="M6 7 5 4H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>',
  welcome: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
  browse: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  winback: '<path d="M4 12a8 8 0 1 0 2.2-5.5"/><path d="M4 4v5h5"/>',
  post: '<path d="M4 8h16v10H4z"/><path d="M4 8l8 6 8-6"/><path d="M12 4v4"/>',
  flow: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="6" cy="18" r="2.2"/><path d="M8 7.2 15.8 11M8 16.8 15.8 13"/>',
};

export function FlowGrid({ cards, base }: { cards: FlowCardModel[]; base: string }) {
  if (!cards.length) {
    return (
      <article className="card">
        <p className="empty-state">Nothing is stored yet. Sync Klaviyo, or push rows to POST /api/v1/ingest.</p>
      </article>
    );
  }
  return (
    <div className="flow-grid">
      {cards.map((card) => {
        const kind = flowIconKind(card.name);
        const headline = card.revenuePence ?? card.monthRevenuePence;
        const live = card.status === "live" || (!card.status && ((card.delivered ?? 0) > 0 || (headline ?? 0) > 0));
        const status = card.status === "draft" ? "Draft" : card.status === "manual" ? "Manual" : live ? "Live" : "Quiet";
        const klaviyo = klaviyoFlowUrl(card.id);
        return (
          <article className="flow-card" key={card.id} id={`flow-${card.id}`}>
            <header>
              <span className={`flow-icon is-${kind}`} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[kind] }} />
              </span>
              <div>
                <h3>{card.name}</h3>
                <b className={headline === null ? "is-empty" : ""}>{headline === null ? "Not stored" : formatMoney(headline, card.currency || "GBP")}</b>
              </div>
              <span className={`cal-pill ${live && card.status !== "manual" && card.status !== "draft" ? "is-sent" : "is-planned"}`}>{status}</span>
            </header>
            <WeekDelta current={card.revenuePence} previous={card.previousRevenuePence} currency={card.currency || "GBP"} />
            <p className="muted small">
              Open {formatRate(card.openRate) ?? "Not stored"} · Click {formatRate(card.clickRate) ?? "Not stored"} · {card.delivered === null ? "Recipients not stored" : `${formatCount(card.delivered)} recipients`}
            </p>
            {card.monthRevenuePence !== null ? <p className="muted small">Last 30 days {formatMoney(card.monthRevenuePence, card.currency || "GBP")}</p> : null}
            <div className="row">
              {klaviyo ? (
                <a className="btn ghost sm" href={klaviyo} target="_blank" rel="noreferrer">
                  Open in Klaviyo
                </a>
              ) : null}
              <a className="btn ghost sm" href={`${base}/flows?flow=${encodeURIComponent(card.id)}#ab-tests`}>
                Log test / fix
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}
