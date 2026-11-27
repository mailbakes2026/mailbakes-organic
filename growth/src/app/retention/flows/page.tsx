import { Suspense } from "react";
import { headers } from "next/headers";
import { DataSkeleton } from "@/components/data-skeleton";
import { FlowTests } from "@/components/flow-tests";
import { KlaviyoNotice } from "@/components/klaviyo-notice";
import { PageHeader, SyncFailure } from "@/components/page-header";
import { PerformanceList } from "@/components/performance-list";
import { RefreshActions } from "@/components/refresh-actions";
import { publicBase } from "@/lib/host";
import { listExperiments } from "@/lib/retention/experiment-store";
import { experimentJson } from "@/lib/retention/experiments";
import { loadRetention } from "@/lib/retention/load";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export default function FlowsPage({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  return (
    <>
      <PageHeader
        title="Flows"
        lede="Revenue, recipients and rates, plus the A/B tests running inside them."
        actions={<RefreshActions />}
      />
      <Suspense fallback={<DataSkeleton />}>
        <FlowsBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function FlowsBody({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const query = await searchParams;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const base = publicBase(host, "retention");
  const loaded = await loadRetention();
  let experiments: ReturnType<typeof experimentJson>[] = [];
  try {
    experiments = (await listExperiments()).map(experimentJson);
  } catch (error) {
    logSafe("flow experiments", error);
  }
  if (!loaded.ok) return <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p>;
  const month = loaded.view.flows["30d"];
  const week = loaded.view.flows["7d"];
  const flows = [...month, ...week].filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index);
  return (
    <>
      <KlaviyoNotice />
      <SyncFailure sync={loaded.klaviyo} />
      <PerformanceList
        title="Last 30 days"
        rows={month}
        empty="Nothing is stored for the last 30 days. Sync Klaviyo, or push rows to POST /api/v1/ingest."
        flowHref={(row) => `${base}/flows?flow=${encodeURIComponent(row.id)}#ab-tests`}
      />
      <PerformanceList
        title="Last 7 days"
        rows={week}
        empty="Nothing is stored for the last 7 days."
        flowHref={(row) => `${base}/flows?flow=${encodeURIComponent(row.id)}#ab-tests`}
      />
      <FlowTests experiments={experiments} flows={flows.map((row) => ({ id: row.id, name: row.name }))} focusId={query.flow} allHref={`${base}/flows`} />
    </>
  );
}
