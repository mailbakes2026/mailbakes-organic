import { Inquiries } from "@/components/inquiries";
import { apiToken } from "@/lib/env";
import { ensureSeeded, listCreators } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function InquiriesPage() {
  await ensureSeeded();
  const creators = await listCreators();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inquiries</h1>
          <p className="muted">Inbound requests. Accept moves them to Approved.</p>
        </div>
      </div>
      <Inquiries creators={creators} apiReady={Boolean(apiToken())} />
    </>
  );
}
