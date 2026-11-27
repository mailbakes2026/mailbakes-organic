import { Suspense } from "react";
import { DataSkeleton } from "@/components/data-skeleton";
import { NoteBoard } from "@/components/note-board";
import { PageHeader } from "@/components/page-header";
import { PlanBoard } from "@/components/plan-board";
import { formatLondon } from "@/lib/dates";
import { listNotes } from "@/lib/paidads/store";
import { listPlan } from "@/lib/retention/store";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export default function PlanPage() {
  return (
    <>
      <PageHeader
        title="Q4 plan"
        lede="Kyle, kyle@flowsha.com, lifecycle freelancer. October to December 2026. A line stays open until a decision is written here."
      />
      <Suspense fallback={<DataSkeleton />}>
        <PlanBody />
      </Suspense>
    </>
  );
}

async function PlanBody() {
  try {
    const [items, notes] = await Promise.all([listPlan(), listNotes("retention", "review")]);
    const open = items.filter((item) => item.status !== "decided").length;
    return (
      <>
        <p className="metric-line">
          <b className={open === 0 ? "is-good" : undefined}>{open === 0 ? "All done" : open}</b>{" "}
          {open === 0 ? "every line has a decision" : open === 1 ? "line still open" : "lines still open"}
          <span className="metric-sep"> · </span>
          <b>{items.length}</b> in the plan
        </p>
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
        <h2 className="section-title">Retention Reviews</h2>
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
