import { Suspense } from "react";
import { ConnectionCard } from "@/components/connection";
import { DataSkeleton } from "@/components/data-skeleton";
import { KlaviyoNotice } from "@/components/klaviyo-notice";
import { RetentionMetaCard } from "@/components/meta-snapshot";
import { MetricLine, PageHeader, SyncFailure } from "@/components/page-header";
import { RefreshActions } from "@/components/refresh-actions";
import { connectionCopy } from "@/lib/connection";
import { formatCount, formatRate, revenueLabel } from "@/lib/format";
import { klaviyoMissing, shopifyMissing } from "@/lib/env";
import { KLAVIYO_NOT_CONNECTED } from "@/lib/retention/klaviyo-copy";
import { loadRetention } from "@/lib/retention/load";

export const dynamic = "force-dynamic";

export default function RetentionOverview() {
  return (
    <>
      <PageHeader
        title="Overview"
        lede="Klaviyo and Shopify, with Meta spend beside them. Figures are the last stored sync."
        actions={<RefreshActions shopify />}
      />
      <Suspense fallback={<DataSkeleton />}>
        <OverviewBody />
      </Suspense>
    </>
  );
}

async function OverviewBody() {
  const loaded = await loadRetention();
  const klaviyoGap = klaviyoMissing();
  const klaviyo = connectionCopy({
    name: "Klaviyo",
    missing: klaviyoGap,
    missingDetail: KLAVIYO_NOT_CONNECTED,
    sync: loaded.ok ? loaded.klaviyo : null,
  });
  const shopify = connectionCopy({
    name: "Shopify",
    missing: shopifyMissing(),
    sync: loaded.ok ? loaded.shopify : null,
  });
  const repeat = loaded.ok ? loaded.view.repeat : null;
  const flows = loaded.ok ? loaded.view.flows["30d"] : [];
  const campaigns = loaded.ok ? loaded.view.campaigns["30d"] : [];
  const flowRevenue = revenueLabel(flows);
  const campaignRevenue = revenueLabel(campaigns);
  const listCount = loaded.ok ? loaded.view.lists.length : 0;

  return (
    <>
      <KlaviyoNotice />
      {loaded.ok ? <SyncFailure sync={loaded.klaviyo} /> : null}
      {!loaded.ok ? <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p> : null}
      <MetricLine
        parts={[
          { value: flowRevenue ?? "", label: "flow revenue, 30 days" },
          { value: campaignRevenue ?? "", label: "campaign revenue" },
          { value: repeat ? formatRate(repeat.rate) ?? "" : "", label: "repeat purchase" },
          { value: listCount ? String(listCount) : "", label: listCount === 1 ? "list" : "lists" },
        ]}
      />
      <section className="connections">
        <ConnectionCard title="Klaviyo" label={klaviyo.label} state={klaviyo.state} detail={klaviyo.detail} />
        <ConnectionCard title="Shopify" label={shopify.label} state={shopify.state} detail={shopify.detail} />
      </section>
      <section className="stats" aria-label="Retention summary">
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
        {loaded.ok ? <RetentionMetaCard snapshot={loaded.meta} connected={loaded.metaConnected} /> : null}
        <article className="stat">
          <span className="eyebrow">Repeat purchase</span>
          <b className={`stat-num${repeat ? "" : " is-empty"}`}>{repeat ? formatRate(repeat.rate) : "—"}</b>
          <span className="muted small">{repeat ? `${formatCount(repeat.repeatCustomers)} of ${formatCount(repeat.customers)} customers` : "No Shopify orders stored."}</span>
        </article>
        <article className="stat">
          <span className="eyebrow">Lists</span>
          <b className={`stat-num${listCount ? "" : " is-empty"}`}>{loaded.ok ? listCount : "—"}</b>
          <span className="muted small">{listCount ? "Snapshots on Customers." : "No list snapshots stored."}</span>
        </article>
      </section>
    </>
  );
}
