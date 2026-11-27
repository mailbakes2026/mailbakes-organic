import { RateBar } from "@/components/rate-bar";
import { formatCount, formatMoney, formatRate } from "@/lib/format";
import type { SendFact } from "@/lib/retention/metrics";

export function PerformanceList({
  title,
  rows,
  empty,
  flowHref,
}: {
  title: string;
  rows: SendFact[];
  empty: string;
  flowHref?: (row: SendFact) => string;
}) {
  const maxRevenue = Math.max(1, ...rows.map((row) => row.revenuePence ?? 0));
  const maxRecipients = Math.max(1, ...rows.map((row) => row.delivered ?? 0));
  return (
    <section className="stack-section" aria-label={title}>
      <h2 className="section-title">{title}</h2>
      {rows.length === 0 ? (
        <article className="card">
          <p className="empty-state">{empty}</p>
        </article>
      ) : (
        <div className="perf-list">
          {rows.map((row) => {
            const live = (row.delivered ?? 0) > 0 || (row.revenuePence ?? 0) > 0 || (row.opens ?? 0) > 0;
            return (
              <article className="perf-card" key={`${row.window}:${row.id}`} id={flowHref ? `flow-${row.id}` : undefined}>
                <header>
                  <div>
                    <h3>{row.name}</h3>
                    <b className={row.revenuePence === null ? "is-empty" : ""}>{row.revenuePence === null ? "—" : formatMoney(row.revenuePence, row.currency || "GBP")}</b>
                  </div>
                  <span className={`cal-pill ${live ? "is-sent" : "is-planned"}`}>{live ? "Live" : "Quiet"}</span>
                </header>
                <RateBar
                  label="Revenue"
                  value={row.revenuePence === null ? "—" : formatMoney(row.revenuePence, row.currency || "GBP")}
                  width={row.revenuePence === null ? 0 : (row.revenuePence / maxRevenue) * 100}
                />
                <RateBar
                  label="Recipients"
                  value={row.delivered === null ? "—" : formatCount(row.delivered) ?? "—"}
                  width={row.delivered === null ? 0 : (row.delivered / maxRecipients) * 100}
                />
                <RateBar label="Open" value={formatRate(row.openRate) ?? "—"} width={(row.openRate ?? 0) * 100} />
                <RateBar label="Click" value={formatRate(row.clickRate) ?? "—"} width={(row.clickRate ?? 0) * 100} />
                <RateBar label="Placed order" value="Not stored" width={0} note="Klaviyo has not stored a placed order rate on this row." />
                {flowHref ? (
                  <a className="subtle" href={flowHref(row)}>
                    A/B tests
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
