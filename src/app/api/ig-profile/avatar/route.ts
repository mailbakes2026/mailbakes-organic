import { handle, requireUser } from "@/lib/api";
import { clearIgAvatar, setIgAvatar } from "@/lib/ig-profile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    await requireUser();
    return Response.json(await setIgAvatar(await request.formData()));
  });
}

export async function DELETE() {
  return handle(async () => {
    await requireUser();
    return Response.json(await clearIgAvatar());
  });
}
