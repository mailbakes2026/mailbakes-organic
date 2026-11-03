import { formatMoney } from "@/lib/format";
import type { MetaSnapshot, RankedAd } from "@/lib/paidads/snapshot";

export function MetaSnapshotCard({ snapshot }: { snapshot: MetaSnapshot }) {
  return (
    <>
      <article className="card">
        <div className="subhead">
          <h2>Meta</h2>
          <span className="eyebrow">London</span>
        </div>
        <p className="muted small">
          Spend, purchases and ROAS come from Meta. Blended MER is Shopify revenue ÷ Meta spend. Today is the day so far.
        </p>
        <div className="figure-row">
          {snapshot.windows.map((window) => (
            <div className="figure" key={window.key}>
              <span className="eyebrow">
                {window.label}
                {window.partial ? " · partial" : ""}
              </span>
              <b className={window.spendPence === null ? "is-empty" : ""}>{window.spendLabel}</b>
              <span className="muted small">Purchases {window.purchasesLabel}</span>
              <span className="muted small">ROAS {window.roasLabel}</span>
              <span className="muted small">MER {window.merLabel}</span>
              <span className="muted small">Shopify {window.shopifyLabel}</span>
              {window.note ? <span className="muted small">{window.note}</span> : null}
            </div>
          ))}
        </div>
      </article>
      <div className="pair">
        <AdRankTable
          title="Top 5 ads by ROAS"
          rows={snapshot.top}
          hint={adHint(snapshot, "Highest ROAS first.")}
        />
        <AdRankTable title="Bottom 5 ads by ROAS" rows={snapshot.bottom} hint={adHint(snapshot, "Lowest ROAS first.")} />
      </div>
    </>
  );
}

function adHint(snapshot: MetaSnapshot, lead: string) {
  const parts = [lead, "Last 7 days. An ad needs at least £50 of spend."];
  if (snapshot.belowMinimum > 0) {
    parts.push(
      snapshot.belowMinimum === 1
        ? "1 ad spent under £50 and is left out."
        : `${snapshot.belowMinimum} ads spent under £50 and are left out.`,
    );
  }
  if (snapshot.adNote) parts.push(snapshot.adNote);
  return parts.join(" ");
}

function AdRankTable({ title, rows, hint }: { title: string; rows: RankedAd[]; hint: string }) {
  return (
    <article className="card">
      <div className="subhead">
        <h2>{title}</h2>
      </div>
      <p className="muted small">{hint}</p>
      {rows.length === 0 ? (
        <p className="empty-state">Nothing to list.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Ad</th>
                <th className="num">Spend</th>
                <th className="num">Purchases</th>
                <th className="num">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="name">
                    {row.name}
                    {row.campaignName || row.adsetName ? (
                      <div className="muted small">{[row.campaignName, row.adsetName].filter(Boolean).join(" · ")}</div>
                    ) : null}
                  </td>
                  <td className="num">{formatMoney(row.spendPence, row.currency)}</td>
                  <td className="num">{row.purchases}</td>
                  <td className="num">{row.roasLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function RetentionMetaCard({ snapshot, connected }: { snapshot: MetaSnapshot; connected: boolean }) {
  const week = snapshot.windows.find((window) => window.key === "seven");
  if (!week) return null;
  const quiet = week.spendPence === null;
  return (
    <article className="stat">
      <span className="eyebrow">Meta, 7 days</span>
      <b className={`stat-num${quiet ? " is-empty" : ""}`}>{week.spendLabel}</b>
      <span className="muted small">
        {!connected && quiet ? "Meta is not connected." : `MER ${week.merLabel} · Shopify ${week.shopifyLabel}`}
      </span>
      <span className="muted small">
        {week.audience.newCustomers === null && week.audience.note
          ? week.audience.note
          : `New ${week.audience.newLabel} · Returning ${week.audience.returningLabel}`}
      </span>
      {week.audience.note && week.audience.newCustomers !== null ? <span className="muted small">{week.audience.note}</span> : null}
    </article>
  );
}
