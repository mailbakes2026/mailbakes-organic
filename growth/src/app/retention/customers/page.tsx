import { Suspense } from "react";
import { DataSkeleton } from "@/components/data-skeleton";
import { PageHeader, SyncFailure } from "@/components/page-header";
import { RefreshActions } from "@/components/refresh-actions";
import { formatDay } from "@/lib/dates";
import { formatCount, formatMoney } from "@/lib/format";
import { loadRetention } from "@/lib/retention/load";
import { listSummary, type CustomerPicture, type CustomerSegment } from "@/lib/retention/metrics";

export const dynamic = "force-dynamic";

export default function CustomersPage() {
  return (
    <>
      <PageHeader
        title="Customers"
        lede="Who is new, who is due another order, and how each cohort comes back."
        actions={<RefreshActions shopify />}
      />
      <Suspense fallback={<DataSkeleton />}>
        <CustomersBody />
      </Suspense>
    </>
  );
}

function money(pence: number | null, currency: string, mixed: boolean) {
  if (mixed) return "Mixed";
  if (pence === null) return "—";
  return formatMoney(pence, currency || "GBP");
}

function heatStyle(rate: number | null) {
  if (rate === null) return { background: "#F7F4F2", color: "#8A817C" };
  const shade = 0.12 + rate * 0.88;
  return {
    background: `rgba(237, 33, 122, ${shade.toFixed(3)})`,
    color: rate >= 0.55 ? "#ffffff" : "#1E1A1C",
  };
}

function Split({ picture }: { picture: CustomerPicture }) {
  const customers = Math.max(picture.customers, 1);
  const newWidth = (picture.newCustomers / customers) * 100;
  const revenueKnown = picture.newRevenuePence !== null && picture.returningRevenuePence !== null && !picture.mixed;
  const revenueTotal = (picture.newRevenuePence ?? 0) + (picture.returningRevenuePence ?? 0);
  const newRevenueWidth = revenueKnown && revenueTotal > 0 ? ((picture.newRevenuePence ?? 0) / revenueTotal) * 100 : newWidth;
  return (
    <article className="card">
      <h2>New vs returning</h2>
      <p className="muted small">
        From {formatDay(picture.first)} to {formatDay(picture.last)}. A customer is returning after a second order. Guest checkouts stay out.
      </p>
      <div className="split-block">
        <div>
          <span className="eyebrow">Customers</span>
          <div className="split-bar" aria-hidden="true">
            <i className="is-new" style={{ width: `${newWidth}%` }} />
            <i className="is-return" style={{ width: `${100 - newWidth}%` }} />
          </div>
        </div>
        {revenueKnown ? (
          <div>
            <span className="eyebrow">Revenue</span>
            <div className="split-bar" aria-hidden="true">
              <i className="is-new" style={{ width: `${newRevenueWidth}%` }} />
              <i className="is-return" style={{ width: `${100 - newRevenueWidth}%` }} />
            </div>
          </div>
        ) : null}
      </div>
      <div className="pair">
        <article className="stat">
          <span className="eyebrow">New</span>
          <b className="stat-num">{formatCount(picture.newCustomers)}</b>
          <span className="muted small">{money(picture.newRevenuePence, picture.currency, picture.mixed)} revenue</span>
        </article>
        <article className="stat">
          <span className="eyebrow">Returning</span>
          <b className="stat-num">{formatCount(picture.returningCustomers)}</b>
          <span className="muted small">{money(picture.returningRevenuePence, picture.currency, picture.mixed)} revenue</span>
        </article>
      </div>
      <p>
        <b>{picture.avgDaysToSecond === null ? "Not enough second orders yet" : `${picture.avgDaysToSecond} days`}</b>
        <span className="muted"> average to the second order{picture.secondOrderCustomers ? `, from ${formatCount(picture.secondOrderCustomers)} customers` : ""}.</span>
      </p>
      {picture.guestOrders > 0 ? <p className="muted small">{formatCount(picture.guestOrders)} orders had no customer and are not in this split.</p> : null}
    </article>
  );
}

function SegmentCard({ title, detail, segment, currency }: { title: string; detail: string; segment: CustomerSegment; currency: string }) {
  return (
    <article className="stat segment-card">
      <span className="eyebrow">{title}</span>
      <b className="stat-num">{formatCount(segment.customers)}</b>
      <span className="muted small">{detail}</span>
      <span>{(segment.share * 100).toFixed(0)}% of customers</span>
      <span className="muted small">
        {segment.avgOrders === null ? "No orders" : `${segment.avgOrders.toFixed(1)} orders on average`}
        {" · "}
        {segment.mixed || segment.avgSpendPence === null ? "Spend not stored" : `${formatMoney(segment.avgSpendPence, segment.currency || currency)} average spend`}
      </span>
    </article>
  );
}

async function CustomersBody() {
  const loaded = await loadRetention();
  if (!loaded.ok) return <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p>;
  const { cohorts, lists } = loaded.view;
  const picture = loaded.view.customers;
  const growth = listSummary(lists);
  const netUp = growth.net !== null && growth.net > 0;
  const netDown = growth.net !== null && growth.net < 0;
  return (
    <>
      <SyncFailure sync={loaded.klaviyo} />
      {picture ? (
        <Split picture={picture} />
      ) : (
        <article className="card">
          <h2>New vs returning</h2>
          <p className="empty-state">No Shopify orders with a customer are stored yet.</p>
        </article>
      )}
      <section className="stack-section" aria-label="Customer segments">
        <h2 className="section-title">Who to act on</h2>
        {picture ? (
          <div className="segment-grid">
            <SegmentCard title="VIPs" detail="3 or more orders" segment={picture.vips} currency={picture.currency} />
            <SegmentCard title="Due a reorder" detail="Last ordered 30 to 60 days ago" segment={picture.due} currency={picture.currency} />
            <SegmentCard title="Lapsed" detail="90 days or more since the last order" segment={picture.lapsed} currency={picture.currency} />
          </div>
        ) : (
          <article className="card">
            <p className="empty-state">Segments appear once orders with a customer are stored.</p>
          </article>
        )}
      </section>
      <article className="card">
        <h2>Cohorts</h2>
        {cohorts ? (
          <>
            <p className="muted small">Share of the cohort with an order in that month. Months after {cohorts.latestLabel} are left blank. A deeper pink means more of the cohort came back.</p>
            <div className="table-wrap">
              <table className="data heat">
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
                        <td key={index} className="num cell" style={heatStyle(rate)}>
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
          <>
            <div className="pair">
              <article className="stat">
                <span className="eyebrow">Email profiles</span>
                <b className={`stat-num${growth.total === null ? " is-empty" : ""}`}>{growth.total === null ? "—" : formatCount(growth.total)}</b>
                <span className="muted small">{growth.lists === 1 ? "Latest snapshot" : "Latest snapshot of each list. People on more than one list are counted in each."}</span>
              </article>
              <article className="stat">
                <span className="eyebrow">Net change</span>
                <b className={`stat-num${growth.net === null ? " is-empty" : ""}`}>{growth.net === null ? "—" : formatCount(growth.net)}</b>
                {growth.net === null ? (
                  <span className="wow is-unknown">Needs another snapshot</span>
                ) : (
                  <span className={`wow ${netUp ? "is-up" : netDown ? "is-down" : "is-flat"}`}>{netUp ? "Gained" : netDown ? "Lost" : "No change"}</span>
                )}
              </article>
            </div>
            <div className="list-rows">
              {lists.map((row) => (
                <div className="list-row" key={row.latest.listId}>
                  <b>{row.latest.listName}</b>
                  <span>{row.latest.profiles === null ? "—" : formatCount(row.latest.profiles)}</span>
                  <span className="muted small">{row.latestLabel}</span>
                  <span className={row.delta === null ? "muted" : row.delta > 0 ? "is-on" : row.delta < 0 ? "is-down-text" : ""}>
                    {row.delta === null ? "No earlier snapshot" : `${row.delta > 0 ? "+" : ""}${formatCount(row.delta)}`}
                  </span>
                </div>
              ))}
            </div>
            {growth.missingProfiles ? <p className="muted small">A dash means the latest snapshot did not include a profile count.</p> : null}
          </>
        )}
      </article>
    </>
  );
}
