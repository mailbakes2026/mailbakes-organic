import { ConnectionCard } from "@/components/connection";
import { SyncButton } from "@/components/sync-button";
import { connectionCopy } from "@/lib/connection";
import { formatCount, formatRate } from "@/lib/format";
import { klaviyoMissing, shopifyMissing } from "@/lib/env";
import { loadRetention } from "@/lib/retention/load";

export const dynamic = "force-dynamic";

export default async function RetentionOverview() {
  const loaded = await loadRetention();
  const klaviyo = connectionCopy({
    name: "Klaviyo",
    missing: klaviyoMissing(),
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
  const flowRevenue = revenueSum(flows);
  const campaignRevenue = revenueSum(campaigns);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Retention</h1>
          <p className="muted">Klaviyo and Shopify. A blank means that figure has not been stored.</p>
        </div>
      </div>
      {!loaded.ok ? <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p> : null}
      <section className="connections">
        <ConnectionCard title="Klaviyo" label={klaviyo.label} state={klaviyo.state} detail={klaviyo.detail} />
        <ConnectionCard title="Shopify" label={shopify.label} state={shopify.state} detail={shopify.detail} />
      </section>
      <div className="row" style={{ marginBottom: 16 }}>
        {klaviyoMissing().length === 0 ? <SyncButton href="/api/retention/sync/klaviyo" label="Sync Klaviyo" /> : null}
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

function revenueSum(rows: { revenuePence: number | null; currency: string }[]) {
  const withMoney = rows.filter((row) => row.revenuePence !== null);
  if (!withMoney.length) return null;
  const currencies = [...new Set(withMoney.map((row) => row.currency).filter(Boolean))];
  if (currencies.length !== 1) return "Mixed currencies";
  const total = withMoney.reduce((sum, row) => sum + (row.revenuePence ?? 0), 0);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currencies[0], minimumFractionDigits: 2 }).format(total / 100);
}
