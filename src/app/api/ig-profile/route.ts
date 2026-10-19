import { handle, requireUser } from "@/lib/api";
import { getIgProfile, updateIgProfile } from "@/lib/ig-profile";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireUser();
    return Response.json(await getIgProfile());
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    await requireUser();
    const body = await request.json().catch(() => null);
    return Response.json(await updateIgProfile(body));
  });
}
