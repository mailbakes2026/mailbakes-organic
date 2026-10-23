import { headers } from "next/headers";
import { BreakdownTable } from "@/components/paid-figures";
import { RangeLinks } from "@/components/range-links";
import { publicBase } from "@/lib/host";
import { loadPaid } from "@/lib/paidads/load";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const params = await searchParams;
  const range = params.range === "28d" ? "28d" : "7d";
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const base = `${publicBase(host, "paidads")}/campaigns`;
  const loaded = await loadPaid(range);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Campaigns</h1>
          <p className="muted">Spend, revenue, orders, ROAS and CPA by campaign and ad set.</p>
        </div>
        <RangeLinks base={base} range={range} />
      </div>
      {!loaded.ok ? <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p> : null}
      {loaded.ok ? (
        <>
          <BreakdownTable
            title="Campaigns"
            hint={
              loaded.view.campaignBasis === "adset"
                ? "Rolled up from ad sets. No campaign-level rows are stored for this range."
                : loaded.view.campaignBasis === "campaign"
                  ? `${loaded.view.fromLabel} – ${loaded.view.toLabel}.`
                  : "No campaign or ad set rows are stored for this range."
            }
            rows={loaded.view.campaigns}
          />
          <BreakdownTable
            title="Ad sets"
            hint={loaded.view.adsets.length ? `${loaded.view.fromLabel} – ${loaded.view.toLabel}.` : "No ad set rows are stored for this range."}
            rows={loaded.view.adsets}
          />
        </>
      ) : null}
    </>
  );
}
