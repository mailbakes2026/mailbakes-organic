import { Board } from "@/components/board";
import type { TiktokSync } from "@/lib/sync-status";
import { ensureSeeded, latestTiktokSync, listCreators } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  await ensureSeeded();
  const creators = await listCreators();
  let sync: TiktokSync | null = null;
  try {
    sync = await latestTiktokSync();
  } catch (error) {
    console.error(error);
    sync = { at: new Date().toISOString(), ok: false, message: "We couldn't read the last TikTok sync." };
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">Every creator, from the request to the post.</p>
        </div>
      </div>
      <Board creators={creators} sync={sync} />
    </>
  );
}
