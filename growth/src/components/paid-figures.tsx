import { formatCpa, formatMoney, formatRoas } from "@/lib/format";
import type { PaidView } from "@/lib/paidads/view";

export function PaidFigures({ view }: { view: PaidView }) {
  if (view.mixedCurrencies) {
    return <p className="empty-state">These rows use {view.mixedCurrencies.join(" and ")}, so they are not added together.</p>;
  }
  if (!view.headline) {
    return (
      <p className="empty-state">
        {view.metaConnected
          ? "No daily rows are stored for this range. Sync Meta, or push rows to POST /api/v1/ingest."
          : "No daily rows are stored. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID, or push rows to POST /api/v1/ingest."}
      </p>
    );
  }
  const currency = view.headline.currency;
  return (
    <section className="stats" aria-label="Paid ads totals">
      <article className="stat">
        <span className="eyebrow">Spend</span>
        <b className="stat-num">{formatMoney(view.headline.spendPence, currency)}</b>
        <span className="muted small">{view.levelLabel}</span>
      </article>
      <article className="stat">
        <span className="eyebrow">Revenue</span>
        <b className="stat-num">{formatMoney(view.headline.revenuePence, currency)}</b>
        <span className="muted small">{view.headline.days} days with a row</span>
      </article>
      <article className="stat">
        <span className="eyebrow">Orders</span>
        <b className="stat-num">{view.headline.orders}</b>
        <span className="muted small">Purchase actions, or the ingested order count</span>
      </article>
      <article className="stat">
        <span className="eyebrow">ROAS</span>
        <b className={`stat-num${view.roas ? "" : " is-empty"}`}>{view.roas ?? "—"}</b>
        <span className="muted small">{view.roas ? "Revenue ÷ spend" : "No spend in this range, so ROAS is not shown."}</span>
      </article>
      <article className="stat">
        <span className="eyebrow">CPA</span>
        <b className={`stat-num${view.cpa ? "" : " is-empty"}`}>{view.cpa ?? "—"}</b>
        <span className="muted small">{view.cpa ? "Spend ÷ orders" : "No orders in this range, so CPA is not shown."}</span>
      </article>
    </section>
  );
}

export function WeekCard({
  title,
  from,
  to,
  previousFrom,
  previousTo,
  compare,
}: {
  title: string;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  compare: {
    current: PaidView["partial"]["current"];
    previous: PaidView["partial"]["previous"];
    revenueChangeLabel: string | null;
    spendChangeLabel?: string | null;
    ordersChangeLabel?: string | null;
    targetRevenuePence: number | null;
    ahead: boolean | null;
    reason: string | null;
  };
}) {
  return (
    <article className="card">
      <div className="subhead">
        <h2>{title}</h2>
        <span className="eyebrow">Target +5% revenue</span>
      </div>
      <p className="muted small">
        {from} – {to}, compared with {previousFrom} – {previousTo}.
      </p>
      {!compare.current && !compare.previous ? (
        <p className="empty-state">Neither week has rows, so the 5% target is not shown.</p>
      ) : (
        <div className="figure-row">
          <div className="figure">
            <span className="eyebrow">Revenue</span>
            <b>{compare.current ? formatMoney(compare.current.revenuePence, compare.current.currency) : "—"}</b>
            <span className="muted small">
              {compare.previous ? `Comparison week ${formatMoney(compare.previous.revenuePence, compare.previous.currency)}` : "Comparison week has no rows."}
            </span>
          </div>
          <div className="figure">
            <span className="eyebrow">Change</span>
            <b className={compare.ahead === true ? "delta up" : compare.ahead === false ? "delta down" : ""}>
              {compare.revenueChangeLabel ?? "—"}
            </b>
            <span className="muted small">
              {compare.spendChangeLabel ? `Spend ${compare.spendChangeLabel}` : "Spend change is not shown."}
              {compare.ordersChangeLabel ? ` · Orders ${compare.ordersChangeLabel}` : ""}
            </span>
          </div>
          <div className="figure">
            <span className="eyebrow">5% target</span>
            <b>
              {compare.targetRevenuePence !== null && compare.current
                ? formatMoney(compare.targetRevenuePence, compare.current.currency)
                : "—"}
            </b>
            <span className="muted small">
              {compare.reason
                ? compare.reason
                : compare.ahead === null
                  ? "Target not set."
                  : compare.ahead
                    ? "At or above the target."
                    : "Below the target."}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

export function DailyTable({ view }: { view: PaidView }) {
  if (!view.headline && !view.mixedCurrencies) return null;
  return (
    <article className="card">
      <div className="subhead">
        <h2>By day</h2>
        <span className="muted small">A blank day has no stored row. It is not treated as zero.</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Day</th>
              <th className="num">Spend</th>
              <th className="num">Revenue</th>
              <th className="num">Orders</th>
              <th className="num">ROAS</th>
              <th className="num">CPA</th>
            </tr>
          </thead>
          <tbody>
            {view.daily.map((day) => (
              <tr key={day.date}>
                <td>{day.label}</td>
                {day.totals ? (
                  <>
                    <td className="num">{formatMoney(day.totals.spendPence, day.totals.currency)}</td>
                    <td className="num">{formatMoney(day.totals.revenuePence, day.totals.currency)}</td>
                    <td className="num">{day.totals.orders}</td>
                    <td className="num">{formatRoas(day.totals.revenuePence, day.totals.spendPence) ?? "—"}</td>
                    <td className="num">{formatCpa(day.totals.spendPence, day.totals.orders, day.totals.currency) ?? "—"}</td>
                  </>
                ) : (
                  <td className="missing" colSpan={5}>
                    No row
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function WeekTable({ view }: { view: PaidView }) {
  return (
    <article className="card">
      <div className="subhead">
        <h2>By week</h2>
        <span className="muted small">Monday to Sunday, London. This week runs to today.</span>
      </div>
      {view.weeks.length === 0 ? (
        <p className="empty-state">No weekly rows yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Week</th>
                <th className="num">Spend</th>
                <th className="num">Revenue</th>
                <th className="num">Orders</th>
                <th className="num">Vs prior week</th>
                <th className="num">5% target</th>
              </tr>
            </thead>
            <tbody>
              {view.weeks.map((week) => (
                <tr key={week.from}>
                  <td>
                    {week.label}
                    {week.partial ? " · partial" : ""}
                  </td>
                  <td className="num">{week.totals ? formatMoney(week.totals.spendPence, week.totals.currency) : "—"}</td>
                  <td className="num">{week.totals ? formatMoney(week.totals.revenuePence, week.totals.currency) : "—"}</td>
                  <td className="num">{week.totals ? week.totals.orders : "—"}</td>
                  <td className="num">{week.revenueChangeLabel ?? "—"}</td>
                  <td className="num">{week.targetLabel ?? week.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function BreakdownTable({
  title,
  hint,
  rows,
}: {
  title: string;
  hint: string;
  rows: PaidView["campaigns"];
}) {
  return (
    <article className="card">
      <div className="subhead">
        <h2>{title}</h2>
      </div>
      <p className="muted small">{hint}</p>
      {rows.length === 0 ? (
        <p className="empty-state">Nothing is stored at this level for the selected range.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Spend</th>
                <th className="num">Revenue</th>
                <th className="num">Orders</th>
                <th className="num">ROAS</th>
                <th className="num">CPA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="name">
                    {row.name}
                    {row.campaignName && row.campaignName !== row.name ? <div className="muted small">{row.campaignName}</div> : null}
                  </td>
                  <td className="num">{formatMoney(row.spendPence, row.currency)}</td>
                  <td className="num">{formatMoney(row.revenuePence, row.currency)}</td>
                  <td className="num">{row.orders}</td>
                  <td className="num">{formatRoas(row.revenuePence, row.spendPence) ?? "—"}</td>
                  <td className="num">{formatCpa(row.spendPence, row.orders, row.currency) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
