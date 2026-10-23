import { Board } from "@/components/board";
import { ensureSeeded, listCreators } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  await ensureSeeded();
  const creators = await listCreators();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">Every creator, from the request to the post.</p>
        </div>
      </div>
      <Board creators={creators} />
    </>
  );
}
