import { NoteBoard } from "@/components/note-board";
import { PlanBoard } from "@/components/plan-board";
import { formatLondon } from "@/lib/dates";
import { listNotes } from "@/lib/paidads/store";
import { listPlan } from "@/lib/retention/store";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  try {
    const [items, notes] = await Promise.all([listPlan(), listNotes("retention", "review")]);
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Q4 plan</h1>
            <p className="muted">Kyle, kyle@flowsha.com, lifecycle freelancer. October to December 2026. A line stays open until a decision is written here.</p>
          </div>
        </div>
        <PlanBoard
          items={items.map((item) => ({
            id: item.id,
            title: item.title,
            detail: item.detail,
            decision: item.decision,
            status: item.status,
            updatedBy: item.updatedBy,
            when: item.updatedBy ? formatLondon(item.updatedAt) : "",
          }))}
        />
        <div style={{ height: 18 }} />
        <h2 style={{ marginBottom: 10 }}>Retention Reviews</h2>
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
    logSafe("plan", error);
    return <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p>;
  }
}
