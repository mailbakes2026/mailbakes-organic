import { formatChange, formatMoney, formatRate } from "@/lib/format";
import type { WeekCard, WeekStory } from "@/lib/retention/weeks";

function money(pence: number | null) {
  if (pence === null) return "Not stored";
  return formatMoney(pence, "GBP");
}

function cardValue(card: WeekCard) {
  if (card.mixed) return "Mixed";
  if (card.key === "repeat") return formatRate(card.rate);
  if (card.pence === null) return null;
  return formatMoney(card.pence, card.currency || "GBP");
}

function Change({ card }: { card: WeekCard }) {
  if (card.direction === "unknown") return <span className="wow is-unknown">{card.unknownLabel}</span>;
  if (card.direction === "flat") return <span className="wow is-flat">No change</span>;
  const label = formatChange(card.change);
  if (!label) return <span className="wow is-unknown">{card.unknownLabel}</span>;
  return <span className={`wow is-${card.direction}`}>{card.direction === "up" ? "Up" : "Down"} {label}</span>;
}

export function WeekPulse({ story }: { story: WeekStory }) {
  const max = Math.max(1, ...story.bars.flatMap((bar) => [bar.flowPence ?? 0, bar.campaignPence ?? 0]));
  const any = story.bars.some((bar) => (bar.flowPence ?? 0) > 0 || (bar.campaignPence ?? 0) > 0);
  return (
    <section className="week-pulse" aria-label="This week against last week">
      <div className="summary-grid">
        {story.cards.map((card) => {
          const value = cardValue(card);
          return (
            <article className="stat" key={card.key}>
              <span className="eyebrow">{card.label}</span>
              <b className={`stat-num${value ? "" : " is-empty"}`}>{value ?? "—"}</b>
              <Change card={card} />
              <span className="muted small">{card.hint}</span>
            </article>
          );
        })}
      </div>
      <p className="muted small week-note">{story.note}</p>
      <article className="card">
        <div className="subhead">
          <h2>Weekly revenue</h2>
          <span className="legend-inline">
            <i className="is-flow" /> Flow
            <i className="is-campaign" /> Campaign
          </span>
        </div>
        {any ? (
          <div className="trend-scroll">
            <div className="trend" role="img" aria-label="Flow and campaign revenue for recent weeks">
              {story.bars.map((bar) => (
                <div className="trend-col" key={bar.weekStart}>
                  <div className="trend-bars">
                    <i className="is-flow" style={{ height: `${((bar.flowPence ?? 0) / max) * 100}%` }} title={`Flow ${money(bar.flowPence)}`} />
                    <i className="is-campaign" style={{ height: `${((bar.campaignPence ?? 0) / max) * 100}%` }} title={`Campaign ${money(bar.campaignPence)}`} />
                  </div>
                  <span>{bar.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-state">No weekly revenue is stored yet. Bars appear as syncs are kept, and earlier campaign weeks can use calendar results.</p>
        )}
        <p className="muted small">{story.chartNote}</p>
      </article>
    </section>
  );
}
