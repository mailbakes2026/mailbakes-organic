import { Performance } from "@/components/performance";
import { ensureSeeded, listCreators } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  await ensureSeeded();
  const creators = await listCreators();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Performance</h1>
          <p className="muted">Who posted, and how the card did. A blank means it has not been entered.</p>
        </div>
      </div>
      <Performance creators={creators} />
    </>
  );
}
