import { Suspense } from "react";
import { headers } from "next/headers";
import { DataSkeleton } from "@/components/data-skeleton";
import { FlowGrid } from "@/components/flow-grid";
import { FlowTests } from "@/components/flow-tests";
import { KlaviyoNotice } from "@/components/klaviyo-notice";
import { PageHeader, SyncFailure } from "@/components/page-header";
import { RefreshActions } from "@/components/refresh-actions";
import { publicBase } from "@/lib/host";
import { flowCallouts, flowCards } from "@/lib/retention/attention";
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
        lede="Every flow on one screen, with this week against last week."
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
  const cards = flowCards({ week, month, previous: loaded.view.flows.prev });
  const callouts = flowCallouts(cards, experiments);
  const flows = cards.map((row) => ({ id: row.id, name: row.name }));
  return (
    <>
      <KlaviyoNotice />
      <SyncFailure sync={loaded.klaviyo} />
      <section className="attention" aria-label="Needs attention this week">
        <h2>Needs attention this week</h2>
        {callouts.length ? (
          callouts.map((note) => <p key={note}>{note}</p>)
        ) : (
          <p>Nothing needs attention this week.</p>
        )}
      </section>
      <FlowGrid cards={cards} base={base} />
      <FlowTests experiments={experiments} flows={flows} focusId={query.flow} allHref={`${base}/flows`} />
    </>
  );
}
