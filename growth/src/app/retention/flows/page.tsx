import { SendTable } from "@/components/retention-tables";
import { loadRetention } from "@/lib/retention/load";

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  const loaded = await loadRetention();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Flows</h1>
          <p className="muted">Revenue, opens, clicks and unsubscribes. Rates are shown only when a delivered count was stored.</p>
        </div>
      </div>
      {!loaded.ok ? <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p> : null}
      {loaded.ok ? (
        <>
          <SendTable title="Last 7 days" hint="Klaviyo timeframe last_7_days, or an ingest row with window 7d." rows={loaded.view.flows["7d"]} />
          <SendTable title="Last 30 days" hint="Klaviyo timeframe last_30_days, or an ingest row with window 30d." rows={loaded.view.flows["30d"]} />
        </>
      ) : null}
    </>
  );
}
