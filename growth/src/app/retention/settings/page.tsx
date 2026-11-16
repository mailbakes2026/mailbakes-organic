import { headers } from "next/headers";
import { ConnectionCard } from "@/components/connection";
import { SyncButton } from "@/components/sync-button";
import { connectionCopy } from "@/lib/connection";
import { klaviyoMissing } from "@/lib/env";
import { publicBase } from "@/lib/host";
import { KLAVIYO_NOT_CONNECTED } from "@/lib/retention/klaviyo-copy";
import { loadRetention } from "@/lib/retention/load";

export const dynamic = "force-dynamic";

export default async function RetentionSettings() {
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
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Klaviyo is synced by this Retention app. The private API key stays on the server and is not shown here.</p>
        </div>
      </div>
      {!loaded.ok ? <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p> : null}
      <section className="connections">
        <ConnectionCard title="Klaviyo" label={klaviyo.label} state={klaviyo.state} detail={klaviyo.detail} />
      </section>
      <article className="card">
        <h2>Private API key</h2>
        <p>
          <b>{keySet ? "Set on this service." : "Not set on this service."}</b>
        </p>
        <p className="muted">
          Retention reads <code>KLAVIYO_PRIVATE_API_KEY</code> from the environment of the Render service <code>mailbakes-growth</code>. The value is not stored in the database and is not written into this page.
        </p>
        {keySet ? (
          <p>To rotate the key, create a new private API key in Klaviyo, replace the same variable on that service, then save, rebuild, and deploy.</p>
        ) : (
          <ol className="steps">
            <li>In Klaviyo, create a private API key with read access to accounts, metrics, flows, campaigns and lists.</li>
            <li>In Render, open the web service mailbakes-growth. That service serves retention.mailbakes.com.</li>
            <li>Open Environment and set KLAVIYO_PRIVATE_API_KEY to the key.</li>
            <li>Save, rebuild, and deploy.</li>
            <li>Come back here. The card should say Connected. Flow and campaign figures appear after the sync.</li>
          </ol>
        )}
        <p className="muted small">
          Opening Retention, Flows, Campaigns, Customers or Settings syncs Klaviyo when the last successful sync is more than 6 hours old. A failed sync waits 10 minutes before the next attempt. You can also sync now once the key is set.
        </p>
        <p className="muted small">
          <a href={base || "/"}>Back to Retention</a>
        </p>
      </article>
      {keySet ? <SyncButton href="/api/retention/sync/klaviyo" label="Sync Klaviyo" /> : null}
    </>
  );
}
