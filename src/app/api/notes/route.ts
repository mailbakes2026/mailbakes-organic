import { handle, requireUser } from "@/lib/api";
import { createNote } from "@/lib/notes";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const note = await createNote(user, await request.formData());
    return Response.json(note, { status: 201 });
  });
}
