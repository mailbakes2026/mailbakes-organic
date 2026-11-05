import { headers } from "next/headers";
import { ConnectionCard } from "@/components/connection";
import { RetentionMetaCard } from "@/components/meta-snapshot";
import { SyncButton } from "@/components/sync-button";
import { connectionCopy } from "@/lib/connection";
import { formatCount, formatRate, revenueLabel } from "@/lib/format";
import { klaviyoMissing, shopifyMissing } from "@/lib/env";
import { publicBase } from "@/lib/host";
import { KLAVIYO_NOT_CONNECTED } from "@/lib/retention/klaviyo-copy";
import { loadRetention } from "@/lib/retention/load";

export const dynamic = "force-dynamic";

export default async function RetentionOverview() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const settingsHref = `${publicBase(host, "retention")}/settings`;
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Retention</h1>
          <p className="muted">Klaviyo and Shopify, with Meta spend beside them. A blank means that figure has not been stored.</p>
        </div>
      </div>
      {!loaded.ok ? <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p> : null}
      <section className="connections">
        <ConnectionCard title="Klaviyo" label={klaviyo.label} state={klaviyo.state} detail={klaviyo.detail} />
        <ConnectionCard title="Shopify" label={shopify.label} state={shopify.state} detail={shopify.detail} />
      </section>
      {klaviyoGap.length ? (
        <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
          <a href={settingsHref}>Open Settings</a> for the full steps.
        </p>
      ) : null}
      <div className="row" style={{ marginBottom: 16 }}>
        {klaviyoGap.length === 0 ? <SyncButton href="/api/retention/sync/klaviyo" label="Sync Klaviyo" /> : null}
        {shopifyMissing().length === 0 ? <SyncButton href="/api/retention/sync/shopify" label="Sync Shopify" /> : null}
      </div>
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
          <b className={`stat-num${loaded.ok && loaded.view.lists.length ? "" : " is-empty"}`}>{loaded.ok ? loaded.view.lists.length : "—"}</b>
          <span className="muted small">{loaded.ok && loaded.view.lists.length ? "Snapshots on the customers page." : "No list snapshots stored."}</span>
        </article>
      </section>
    </>
  );
}
