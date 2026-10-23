import { handleIngest } from "@/lib/ingest-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleIngest(request, null);
}
