import { requireSession } from "@/lib/guard";
import { json } from "@/lib/http";
import { checkTiktokMessage, ensureSeeded } from "@/lib/records";

export const dynamic = "force-dynamic";

const ID = /^[a-zA-Z0-9_-]{6,40}$/;

export async function GET(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID.test(id)) return json({ error: "That creator isn't on the board." }, 404);
  try {
    await ensureSeeded();
    const check = await checkTiktokMessage(id);
    if (!check) return json({ error: "That creator isn't on the board." }, 404);
    return json({ check });
  } catch (error) {
    console.error(error);
    return json({ error: "We couldn't reach the database. Try again shortly." }, 503);
  }
}
