import { Suspense } from "react";
import { DataSkeleton } from "@/components/data-skeleton";
import { KlaviyoNotice } from "@/components/klaviyo-notice";
import { MetricLine, PageHeader, SyncFailure } from "@/components/page-header";
import { RefreshActions } from "@/components/refresh-actions";
import { SendTable } from "@/components/retention-tables";
import { revenueLabel } from "@/lib/format";
import { loadRetention } from "@/lib/retention/load";

export const dynamic = "force-dynamic";

export default function FlowsPage() {
  return (
    <>
      <PageHeader
        title="Flows"
        lede="Revenue, opens, clicks and unsubscribes. Rates show only when a delivered count was stored."
        actions={<RefreshActions />}
      />
      <Suspense fallback={<DataSkeleton />}>
        <FlowsBody />
      </Suspense>
    </>
  );
}

async function FlowsBody() {
  const loaded = await loadRetention();
  const week = loaded.ok ? loaded.view.flows["7d"] : [];
  const month = loaded.ok ? loaded.view.flows["30d"] : [];
  return (
    <>
      <KlaviyoNotice />
      {loaded.ok ? <SyncFailure sync={loaded.klaviyo} /> : null}
      {!loaded.ok ? <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p> : null}
      <MetricLine
        parts={[
          { value: month.length ? String(month.length) : "", label: month.length === 1 ? "flow, 30 days" : "flows, 30 days" },
          { value: revenueLabel(month) ?? "", label: "revenue" },
          { value: week.length ? String(week.length) : "", label: "in the last 7 days" },
        ]}
      />
      {loaded.ok ? (
        <>
          <SendTable title="Last 7 days" hint="Klaviyo timeframe last_7_days, or an ingest row with window 7d." rows={week} />
          <SendTable title="Last 30 days" hint="Klaviyo timeframe last_30_days, or an ingest row with window 30d." rows={month} />
        </>
      ) : null}
    </>
  );
}
