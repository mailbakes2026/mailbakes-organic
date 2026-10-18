import { handle, requireUser } from "@/lib/api";
import { createKeyDate } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const row = await createKeyDate(user, await request.formData());
    return Response.json(row, { status: 201 });
  });
}
