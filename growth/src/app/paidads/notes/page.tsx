import { NoteBoard } from "@/components/note-board";
import { formatLondon } from "@/lib/dates";
import { listNotes } from "@/lib/paidads/store";
import { logSafe } from "@/lib/scrub";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  try {
    const notes = await listNotes("paidads", "note");
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Notes</h1>
            <p className="muted">A shared pad for Millie and Mikey.</p>
          </div>
        </div>
        <NoteBoard
          title="Millie and Mikey"
          hint="Write what you want the other person to see. This is not pulled from an ad account."
          action="/api/paidads/notes"
          authors={["Millie", "Mikey"]}
          notes={notes.map((note) => ({ id: note.id, author: note.author, body: note.body, when: formatLondon(note.createdAt) }))}
        />
      </>
    );
  } catch (error) {
    logSafe("notes", error);
    return <p className="alert warn">We could not read the database. Check the disk and DATABASE_URL.</p>;
  }
}
