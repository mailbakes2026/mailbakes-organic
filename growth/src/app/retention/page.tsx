import { Suspense } from "react";
import { headers } from "next/headers";
import { DataSkeleton } from "@/components/data-skeleton";
import { PageHeader, SyncFailure } from "@/components/page-header";
import { RefreshActions } from "@/components/refresh-actions";
import { WeekPulse } from "@/components/week-pulse";
import { formatCount, formatRate, revenueLabel } from "@/lib/format";
import { publicBase } from "@/lib/host";
import { loadRetention } from "@/lib/retention/load";

export const dynamic = "force-dynamic";

export default function RetentionOverview() {
  return (
    <>
      <PageHeader
        title="Overview"
        lede="How retention moved this week, from the figures already stored."
        actions={<RefreshActions shopify />}
      />
      <Suspense fallback={<DataSkeleton />}>
        <OverviewBody />
      </Suspense>
    </>
  );
}

async function OverviewBody() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const settings = `${publicBase(host, "retention")}/settings`;
  const loaded = await loadRetention();
  if (!loaded.ok) return <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p>;
  const flows = loaded.view.flows["30d"];
  const campaigns = loaded.view.campaigns["30d"];
  const repeat = loaded.view.repeat;
  const flowRevenue = revenueLabel(flows);
  const campaignRevenue = revenueLabel(campaigns);
  const klaviyoOn = loaded.klaviyo?.status === "ok";
  const shopifyOn = loaded.shopify?.status === "ok";

  return (
    <>
      <WeekPulse story={loaded.weeks} />
      <SyncFailure sync={loaded.klaviyo} />
      <section className="stats secondary-stats" aria-label="Last 30 days">
        <article className="stat">
          <span className="eyebrow">Flow revenue, 30d</span>
          <b className={`stat-num${flowRevenue ? "" : " is-empty"}`}>{flowRevenue ?? "—"}</b>
          <span className="muted small">{flows.length ? `${flows.length} flows` : "No flow rows stored."}</span>
        </article>
        <article className="stat">
          <span className="eyebrow">Campaign revenue, 30d</span>
          <b className={`stat-num${campaignRevenue ? "" : " is-empty"}`}>{campaignRevenue ?? "—"}</b>
          <span className="muted small">{campaigns.length ? `${campaigns.length} campaigns` : "No campaign rows stored."}</span>
        </article>
        <article className="stat">
          <span className="eyebrow">Repeat purchase, all orders</span>
          <b className={`stat-num${repeat ? "" : " is-empty"}`}>{repeat ? formatRate(repeat.rate) : "—"}</b>
          <span className="muted small">{repeat ? `${formatCount(repeat.repeatCustomers)} of ${formatCount(repeat.customers)} customers` : "No Shopify orders stored."}</span>
        </article>
        <article className="stat">
          <span className="eyebrow">Lists</span>
          <b className={`stat-num${loaded.view.lists.length ? "" : " is-empty"}`}>{loaded.view.lists.length}</b>
          <span className="muted small">{loaded.view.lists.length ? "Snapshots on Customers." : "No list snapshots stored."}</span>
        </article>
      </section>
      <p className="quiet-status">
        <span className={klaviyoOn ? "is-on" : ""}>Klaviyo {klaviyoOn ? "connected" : "not connected"}</span>
        <span className="metric-sep"> · </span>
        <span className={shopifyOn ? "is-on" : ""}>Shopify {shopifyOn ? "connected" : "not connected"}</span>
        <span className="metric-sep"> · </span>
        <a href={settings}>Connection setup is in Settings</a>
      </p>
    </>
  );
}
