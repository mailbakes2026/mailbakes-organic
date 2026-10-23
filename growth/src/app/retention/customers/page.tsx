import { formatCount } from "@/lib/format";
import { loadRetention } from "@/lib/retention/load";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const loaded = await loadRetention();
  if (!loaded.ok) return <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p>;
  const { repeat, cohorts, lists } = loaded.view;
  const maxBucket = repeat ? Math.max(...repeat.histogram.map((bucket) => bucket.count), 1) : 1;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p className="muted">Repeat purchase, order counts, cohorts and list growth. Guest checkouts are excluded from the rates.</p>
        </div>
      </div>
      <article className="card">
        <h2>Repeat purchase</h2>
        {repeat ? (
          <>
            <p>
              <b>{repeat.rateLabel}</b> of customers ordered more than once. {formatCount(repeat.repeatCustomers)} of {formatCount(repeat.customers)} customers, from {repeat.firstLabel} to {repeat.lastLabel}.
            </p>
            {repeat.guestOrders > 0 ? <p className="muted">{formatCount(repeat.guestOrders)} orders had no customer and are not in this rate.</p> : null}
            <ul className="bars" aria-label="Customers by order count">
              {repeat.histogram.map((bucket) => (
                <li key={bucket.label}>
                  <span>{bucket.label}</span>
                  <span className="track">
                    <i style={{ width: `${(bucket.count / maxBucket) * 100}%` }} />
                  </span>
                  <span>{formatCount(bucket.count)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="empty-state">No Shopify orders with a customer are stored. Set SHOPIFY_SHOP, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET, then sync, or push orders to POST /api/v1/ingest.</p>
        )}
      </article>
      <article className="card">
        <h2>Cohorts</h2>
        {cohorts ? (
          <>
            <p className="muted small">Share of the cohort with an order in that month. Months after {cohorts.latestLabel} are left blank. The latest month may be partial.</p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>First order</th>
                    <th className="num">Customers</th>
                    <th className="num">Month 0</th>
                    <th className="num">Month 1</th>
                    <th className="num">Month 2</th>
                    <th className="num">Month 3</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.rows.map((row) => (
                    <tr key={row.cohort}>
                      <td>{row.label}</td>
                      <td className="num">{formatCount(row.customers)}</td>
                      {row.rates.map((rate, index) => (
                        <td key={index} className="num">
                          {rate === null ? "—" : `${(rate * 100).toFixed(0)}%`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="empty-state">No cohort can be built until orders with a customer are stored.</p>
        )}
      </article>
      <article className="card">
        <h2>List growth</h2>
        {lists.length === 0 ? (
          <p className="empty-state">No list snapshots are stored. Sync Klaviyo, or push lists to POST /api/v1/ingest. Growth appears after two dates.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>List</th>
                  <th className="num">Latest</th>
                  <th>When</th>
                  <th className="num">Previous</th>
                  <th className="num">Change</th>
                </tr>
              </thead>
              <tbody>
                {lists.map((row) => (
                  <tr key={row.latest.listId}>
                    <td>{row.latest.listName}</td>
                    <td className="num">{row.latest.profiles === null ? "—" : formatCount(row.latest.profiles)}</td>
                    <td>{row.latestLabel}</td>
                    <td className="num">{row.previous?.profiles === null || !row.previous ? "—" : formatCount(row.previous.profiles)}</td>
                    <td className="num">{row.delta === null ? "—" : formatCount(row.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lists.some((row) => row.latest.profiles === null) ? (
          <p className="muted small">A dash means Klaviyo, or the ingest row, did not include a profile count.</p>
        ) : null}
      </article>
    </>
  );
}
