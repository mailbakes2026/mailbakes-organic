import { headers } from "next/headers";
import { ConnectionCard } from "@/components/connection";
import { DailyTable, PaidFigures, WeekCard, WeekTable } from "@/components/paid-figures";
import { RangeLinks } from "@/components/range-links";
import { SyncButton } from "@/components/sync-button";
import { connectionCopy } from "@/lib/connection";
import { metaMissing } from "@/lib/env";
import { googleAdsStatus } from "@/lib/paidads/google";
import { publicBase } from "@/lib/host";
import { loadPaid } from "@/lib/paidads/load";

export const dynamic = "force-dynamic";

export default async function PaidOverview({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const params = await searchParams;
  const range = params.range === "28d" ? "28d" : "7d";
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const root = publicBase(host, "paidads");
  const base = root || "/";
  const loaded = await loadPaid(range);
  const google = googleAdsStatus();
  const meta = connectionCopy({
    name: "Meta",
    missing: metaMissing(),
    sync: loaded.ok ? loaded.sync : null,
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Paid Ads</h1>
          <p className="muted">Meta and Google, in one place. Figures appear only when a row has been stored.</p>
        </div>
        <RangeLinks base={base} range={range} />
      </div>
      {!loaded.ok ? <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p> : null}
      <section className="connections">
        <ConnectionCard title="Meta" label={meta.label} state={meta.state} detail={meta.detail} />
        <ConnectionCard title="Google Ads" label="Not connected" state="not-connected" detail={google.detail} />
      </section>
      {loaded.ok && loaded.view.googleRows > 0 ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          Ingest has stored Google rows. They are not added into the Meta totals. The live Google connector is still parked.
        </p>
      ) : null}
      {metaMissing().length === 0 ? <SyncButton href="/api/paidads/sync" label="Sync Meta" /> : null}
      {loaded.ok ? (
        <>
          <div style={{ height: 12 }} />
          <PaidFigures view={loaded.view} />
          <WeekCard
            title="This week so far"
            from={loaded.view.partial.fromLabel}
            to={loaded.view.partial.toLabel}
            previousFrom={loaded.view.partial.previousFromLabel}
            previousTo={loaded.view.partial.previousToLabel}
            compare={loaded.view.partial}
          />
          <WeekCard
            title="Last full week"
            from={loaded.view.full.fromLabel}
            to={loaded.view.full.toLabel}
            previousFrom={loaded.view.full.previousFromLabel}
            previousTo={loaded.view.full.previousToLabel}
            compare={loaded.view.full}
          />
          <DailyTable view={loaded.view} />
          <WeekTable view={loaded.view} />
        </>
      ) : null}
    </>
  );
}
