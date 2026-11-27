import { Suspense } from "react";
import { DataSkeleton } from "@/components/data-skeleton";
import { CampaignStudio, type CampaignRow } from "@/components/campaign-studio";
import { KlaviyoNotice } from "@/components/klaviyo-notice";
import { PageHeader, SyncFailure } from "@/components/page-header";
import { RefreshActions } from "@/components/refresh-actions";
import { getSessionUser } from "@/lib/auth";
import { londonToday } from "@/lib/dates";
import { accountRate, matchCampaignDesign } from "@/lib/retention/design-match";
import { loadRetention } from "@/lib/retention/load";
import { listDesignLinks } from "@/lib/retention/calendar/store";
import type { SendFact } from "@/lib/retention/metrics";
import { listPreviews } from "@/lib/retention/preview";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export default function RetentionCampaignsPage() {
  return (
    <>
      <PageHeader
        title="Campaigns"
        lede="What is working, the email itself, and what needs a look."
        actions={<RefreshActions />}
      />
      <Suspense fallback={<DataSkeleton />}>
        <CampaignsBody />
      </Suspense>
    </>
  );
}

function ranked(rows: CampaignRow[]) {
  return [...rows].filter((row) => (row.revenuePence ?? 0) > 0).sort((a, b) => (b.revenuePence ?? 0) - (a.revenuePence ?? 0) || a.name.localeCompare(b.name)).slice(0, 3);
}

function toRow(
  row: SendFact,
  window: "7d" | "30d",
  links: Awaited<ReturnType<typeof listDesignLinks>>,
  weekById: Map<string, SendFact>,
  prevById: Map<string, SendFact>,
  previews: Map<string, { html: string; subject: string }>,
): CampaignRow {
  const match = matchCampaignDesign(row, links);
  const preview = previews.get(row.id);
  const weekRow = weekById.get(row.id);
  const previous = prevById.get(row.id);
  return {
    id: row.id,
    name: row.name,
    window,
    revenuePence: row.revenuePence,
    currency: row.currency || "GBP",
    delivered: row.delivered,
    openRate: row.openRate,
    clickRate: row.clickRate,
    opens: row.opens,
    clicks: row.clicks,
    unsubscribes: row.unsubscribes,
    calendarId: match?.calendarId ?? null,
    sendDate: match?.sendDate ?? null,
    audience: match?.audience ?? "",
    subject: match?.subject || preview?.subject || "",
    design: match?.design ?? null,
    previewHtml: preview?.html ?? "",
    weekRevenuePence: weekRow?.revenuePence ?? (window === "7d" ? row.revenuePence : null),
    previousRevenuePence: previous?.revenuePence ?? null,
    weekOpenRate: weekRow?.openRate ?? (window === "7d" ? row.openRate : null),
  };
}

async function CampaignsBody() {
  const loaded = await loadRetention();
  if (!loaded.ok) return <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p>;
  const user = await getSessionUser();
  const author = user?.name === "Kyle" ? "Kyle" : "Millie";
  let links: Awaited<ReturnType<typeof listDesignLinks>> = [];
  try {
    links = await listDesignLinks();
  } catch (error) {
    logSafe("campaign designs", error);
  }
  const weekRows = loaded.view.campaigns["7d"];
  const monthRows = loaded.view.campaigns["30d"];
  const ids = [...new Set([...weekRows, ...monthRows].map((row) => row.id))];
  let previews = new Map<string, { html: string; subject: string }>();
  try {
    previews = new Map((await listPreviews(ids)).map((row) => [row.campaignId, { html: row.html, subject: row.subject }]));
  } catch (error) {
    logSafe("campaign previews", error);
  }
  const weekById = new Map(weekRows.map((row) => [row.id, row]));
  const prevById = new Map(loaded.view.campaigns.prev.map((row) => [row.id, row]));
  const month = monthRows.map((row) => toRow(row, "30d", links, weekById, prevById, previews));
  const week = weekRows.map((row) => toRow(row, "7d", links, weekById, prevById, previews));
  const monthRanked = ranked(month);
  const spotlight = monthRanked.length ? monthRanked : ranked(week);
  const average = (rows: CampaignRow[]) => ({
    openRate: accountRate(rows.map((row) => ({ delivered: row.delivered, rate: row.openRate }))),
    clickRate: accountRate(rows.map((row) => ({ delivered: row.delivered, rate: row.clickRate }))),
  });
  return (
    <>
      <KlaviyoNotice />
      <SyncFailure sync={loaded.klaviyo} />
      <CampaignStudio
        spotlight={spotlight}
        spotlightLabel={monthRanked.length ? "last 30 days" : "last 7 days"}
        month={month}
        week={week}
        monthAverage={average(month)}
        weekAverage={average(week)}
        today={londonToday()}
        author={author}
      />
    </>
  );
}
