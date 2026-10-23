import { ChangeLog } from "@/components/change-log";
import { formatDay, londonToday } from "@/lib/dates";
import { listChanges } from "@/lib/paidads/store";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export default async function ChangesPage() {
  const today = londonToday();
  try {
    const changes = await listChanges();
    return (
      <>
        <div className="page-head">
          <div>
            <h1>What changed</h1>
            <p className="muted">Budget changes for Millie and Mikey. One Meta change a day.</p>
          </div>
        </div>
        <ChangeLog
          today={formatDay(today)}
          changes={changes
            .filter((change) => change.platform === "meta")
            .map((change) => ({
              id: change.id,
              day: formatDay(change.day),
              author: change.author,
              level: change.level,
              objectName: change.objectName,
              previousPence: change.previousPence,
              nextPence: change.nextPence,
              currency: change.currency,
              note: change.note,
              today: change.day === today,
            }))}
        />
      </>
    );
  } catch (error) {
    logSafe("changes", error);
    return <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p>;
  }
}
