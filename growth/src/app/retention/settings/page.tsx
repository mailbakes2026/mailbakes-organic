import { Suspense } from "react";
import { headers } from "next/headers";
import { ConnectionCard } from "@/components/connection";
import { DataSkeleton } from "@/components/data-skeleton";
import { NoteBoard } from "@/components/note-board";
import { Callout, PageHeader, SyncFailure } from "@/components/page-header";
import { RefreshActions } from "@/components/refresh-actions";
import { connectionCopy } from "@/lib/connection";
import { formatLondon } from "@/lib/dates";
import { klaviyoMissing } from "@/lib/env";
import { publicBase } from "@/lib/host";
import { listNotes } from "@/lib/paidads/store";
import { KLAVIYO_NOT_CONNECTED } from "@/lib/retention/klaviyo-copy";
import { loadRetention } from "@/lib/retention/load";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export default function RetentionSettings() {
  return (
    <>
      <PageHeader
        title="Settings"
        lede="The private API key stays on the server. Retention never shows the value."
        actions={<RefreshActions />}
      />
      <Suspense fallback={<DataSkeleton />}>
        <SettingsBody />
      </Suspense>
    </>
  );
}

async function SettingsBody() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const base = publicBase(host, "retention");
  const loaded = await loadRetention();
  const missing = klaviyoMissing();
  const klaviyo = connectionCopy({
    name: "Klaviyo",
    missing,
    missingDetail: KLAVIYO_NOT_CONNECTED,
    sync: loaded.ok ? loaded.klaviyo : null,
  });
  const keySet = missing.length === 0;

  return (
    <>
      {!loaded.ok ? <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p> : null}
      {loaded.ok ? <SyncFailure sync={loaded.klaviyo} /> : null}
      {keySet ? null : (
        <Callout lead="Klaviyo is not connected.">
          Set KLAVIYO_PRIVATE_API_KEY or KLAVIYO_PRIVATE_KEY on the Render service mailbakes-growth, then save, rebuild, and deploy.
        </Callout>
      )}
      <section className="connections">
        <ConnectionCard title="Klaviyo" label={klaviyo.label} state={klaviyo.state} detail={klaviyo.detail} />
      </section>
      <article className="card">
        <h2>Private API key</h2>
        <p>
          <b className={keySet ? "is-good" : undefined}>{keySet ? "Set on this service." : "Not set on this service."}</b>
        </p>
        <p className="muted">
          Retention reads <code>KLAVIYO_PRIVATE_API_KEY</code>, and falls back to <code>KLAVIYO_PRIVATE_KEY</code> when that is the name already set. The value is not stored in the database and is not written into this page.
        </p>
        {keySet ? (
          <p>To rotate the key, create a new private API key in Klaviyo, replace the same variable on that service, then save, rebuild, and deploy.</p>
        ) : (
          <ol className="steps">
            <li>In Klaviyo, create a private API key with read access to accounts, metrics, flows, campaigns and lists.</li>
            <li>In Render, open the web service mailbakes-growth. That service serves retention.mailbakes.com.</li>
            <li>Open Environment and set KLAVIYO_PRIVATE_API_KEY, or KLAVIYO_PRIVATE_KEY, to the key.</li>
            <li>Save, rebuild, and deploy.</li>
            <li>Come back here. The card should say Connected. Flow and campaign figures appear after Refresh.</li>
          </ol>
        )}
        <p className="muted small">
          Opening Overview, Flows, Campaigns, Customers or Settings reads the figures already stored. If the last successful sync is more than 6 hours old, a new sync starts in the background and does not hold the page. A failed sync waits 10 minutes before the next attempt. Refresh runs a sync now, and gives up if Klaviyo or Shopify takes too long.
        </p>
        <p className="muted small">
          The email calendar uses this same key when a send has a Klaviyo campaign ID. <a href={`${base}/calendar`}>Open the calendar</a>. Campaign planning lives on the calendar.
        </p>
      </article>
      <ReviewNotes />
    </>
  );
}

async function ReviewNotes() {
  try {
    const notes = await listNotes("retention", "review");
    return (
      <>
        <h2 className="section-title">Retention review notes</h2>
        <NoteBoard
          title="Prep notes"
          hint="Notes for the Retention Reviews. This is not a performance figure."
          action="/api/retention/notes"
          authors={["Millie", "Kyle"]}
          notes={notes.map((note) => ({ id: note.id, author: note.author, body: note.body, when: formatLondon(note.createdAt) }))}
        />
      </>
    );
  } catch (error) {
    logSafe("review notes", error);
    return null;
  }
}
