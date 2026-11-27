import { json } from "@/lib/http";
import { authorizeCalendar } from "@/lib/retention/calendar/auth";
import { logSafe } from "@/lib/scrub";

export async function calendarAction(request: Request, run: (actor: string) => Promise<Response>) {
  const auth = await authorizeCalendar(request);
  if (!auth.ok) return auth.response;
  try {
    return await run(auth.actor);
  } catch (error) {
    logSafe("calendar", error);
    return json({ error: "We couldn't update the calendar. Try again shortly." }, 503);
  }
}
