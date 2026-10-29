import { notifyDue } from "@/lib/notify-due";
import { NotifyError, receiveNotice, recentNotices } from "@/lib/notify";
import { sendDueReminders } from "@/lib/appointment-reminders";
import {
  createAppointment,
  deleteAppointment,
  getAppointment,
  importAppointments,
  listAppointments,
  updateAppointment,
} from "@/lib/appointments";
import { pullDebriefs } from "@/lib/debrief-pull";
import {
  addDiaryItem,
  deleteDiaryItem,
  listDebriefs,
  loadDiaryDay,
  receiveDebrief,
  saveDiaryNote,
  updateDiaryItem,
} from "@/lib/diary";
import { londonToday } from "@/lib/dates";
import { ReconnectError } from "@/lib/google";
import { ValidationError } from "@/lib/shapes";
import {
  createBriefing,
  createItem,
  createReminder,
  deleteBriefing,
  deleteItem,
  deleteReminder,
  getBriefing,
  getItem,
  getReminder,
  listBriefings,
  listItems,
  listReminders,
  updateBriefing,
  updateItem,
  updateReminder,
} from "@/lib/records";

function notFound() {
  return Response.json({ error: "That one isn't here." }, { status: 404 });
}

async function readBody(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) throw new ValidationError("Send a JSON object.");
  return body;
}

async function reminders(method: string, request: Request, id?: string) {
  if (method === "GET" && !id) return Response.json({ reminders: await listReminders() });
  if (method === "GET" && id) {
    const reminder = await getReminder(id);
    return reminder ? Response.json({ reminder }) : notFound();
  }
  if (method === "POST" && !id) return Response.json({ reminder: await createReminder(await readBody(request)) }, { status: 201 });
  if (method === "PATCH" && id) {
    const reminder = await updateReminder(id, await readBody(request));
    return reminder ? Response.json({ reminder }) : notFound();
  }
  if (method === "DELETE" && id) return (await deleteReminder(id)) ? Response.json({ ok: true }) : notFound();
  return Response.json({ error: "Not found." }, { status: 404 });
}

async function items(method: string, request: Request, id?: string) {
  if (method === "GET" && !id) return Response.json({ items: await listItems() });
  if (method === "GET" && id) {
    const item = await getItem(id);
    return item ? Response.json({ item }) : notFound();
  }
  if (method === "POST" && !id) return Response.json({ item: await createItem(await readBody(request)) }, { status: 201 });
  if (method === "PATCH" && id) {
    const item = await updateItem(id, await readBody(request));
    return item ? Response.json({ item }) : notFound();
  }
  if (method === "DELETE" && id) return (await deleteItem(id)) ? Response.json({ ok: true }) : notFound();
  return Response.json({ error: "Not found." }, { status: 404 });
}

async function briefings(method: string, request: Request, id?: string) {
  if (method === "GET" && !id) return Response.json({ briefings: await listBriefings() });
  if (method === "GET" && id) {
    const briefing = await getBriefing(id);
    return briefing ? Response.json({ briefing }) : notFound();
  }
  if (method === "POST" && !id) return Response.json({ briefing: await createBriefing(await readBody(request)) }, { status: 201 });
  if (method === "PATCH" && id) {
    const briefing = await updateBriefing(id, await readBody(request));
    return briefing ? Response.json({ briefing }) : notFound();
  }
  if (method === "DELETE" && id) return (await deleteBriefing(id)) ? Response.json({ ok: true }) : notFound();
  return Response.json({ error: "Not found." }, { status: 404 });
}

async function appointments(method: string, request: Request, id?: string) {
  if (method === "GET" && !id) {
    const url = new URL(request.url);
    return Response.json({
      appointments: await listAppointments({ from: url.searchParams.get("from"), to: url.searchParams.get("to") }),
    });
  }
  if (method === "POST" && id === "import") {
    const result = await importAppointments(await readBody(request));
    return Response.json({ created: result.created.length, skipped: result.skipped, appointments: result.created }, { status: 201 });
  }
  if (method === "POST" && id === "send-reminders") {
    // Phone notifications first: they don't need Google.
    const notified = await notifyDue().catch((error) => {
      console.error("notify due", error);
      return null;
    });
    try {
      const reminders = await sendDueReminders();
      const pulled = await pullDebriefs(new Date(), { onlyIfStale: true }).catch(() => null);
      return Response.json({ ...reminders, debriefs: pulled, notified });
    } catch (error) {
      if (error instanceof ReconnectError) return Response.json({ error: error.message }, { status: 409 });
      throw error;
    }
  }
  if (method === "GET" && id) {
    const appointment = await getAppointment(id);
    return appointment ? Response.json({ appointment }) : notFound();
  }
  if (method === "POST" && !id) {
    return Response.json({ appointment: await createAppointment(await readBody(request)) }, { status: 201 });
  }
  if (method === "PATCH" && id) {
    const appointment = await updateAppointment(id, await readBody(request));
    return appointment ? Response.json({ appointment }) : notFound();
  }
  if (method === "DELETE" && id) return (await deleteAppointment(id)) ? Response.json({ ok: true }) : notFound();
  return Response.json({ error: "Not found." }, { status: 404 });
}

async function diary(method: string, request: Request, id?: string) {
  const url = new URL(request.url);
  if (method === "GET" && !id) {
    return Response.json({ diary: await loadDiaryDay(url.searchParams.get("day") || londonToday()) });
  }
  return Response.json({ error: "Not found." }, { status: 404 });
}

async function diaryItems(method: string, request: Request, id?: string) {
  if (method === "POST" && !id) return Response.json({ item: await addDiaryItem(await readBody(request)) }, { status: 201 });
  if (method === "PATCH" && id) {
    const item = await updateDiaryItem(id, await readBody(request));
    return item ? Response.json({ item }) : notFound();
  }
  if (method === "DELETE" && id) return (await deleteDiaryItem(id)) ? Response.json({ ok: true }) : notFound();
  return Response.json({ error: "Not found." }, { status: 404 });
}

async function diaryNotes(method: string, request: Request, id?: string) {
  if ((method === "PATCH" || method === "POST") && id) {
    return Response.json({ note: await saveDiaryNote(id, await readBody(request)) });
  }
  return Response.json({ error: "Not found." }, { status: 404 });
}

/**
 * Debriefs from the other apps.
 * POST /api/v1/debriefs  { source, title, lines[], day?, kind?, link? }  (PERSONAL_API_TOKEN)
 * POST /api/v1/debriefs/pull  fetches every configured app's summary now.
 */
async function debriefs(method: string, request: Request, id?: string) {
  const url = new URL(request.url);
  if (method === "GET" && !id) return Response.json({ debriefs: await listDebriefs(url.searchParams.get("day") || londonToday()) });
  if (method === "POST" && id === "pull") return Response.json(await pullDebriefs());
  if (method === "POST" && !id) return Response.json({ debrief: await receiveDebrief(await readBody(request)) }, { status: 201 });
  return Response.json({ error: "Not found." }, { status: 404 });
}

/**
 * Phone notifications from the other apps.
 * POST /api/v1/notify  { source, title, body?, url?, key?, debrief?: { title, lines[], kind?, day?, link? } }
 * A debrief, if sent, lands in the Diary under the same source.
 */
async function notifyResource(method: string, request: Request, id?: string) {
  if (method === "POST" && !id) {
    const body = (await readBody(request)) as Record<string, unknown> | null;
    let debrief = null;
    try {
      const result = await receiveNotice(body);
      if (body?.debrief && typeof body.debrief === "object") {
        debrief = await receiveDebrief({ ...(body.debrief as object), source: body.source });
      }
      return Response.json({ ...result, debrief }, { status: 201 });
    } catch (error) {
      if (error instanceof NotifyError) return Response.json({ error: error.message }, { status: 400 });
      throw error;
    }
  }
  if (method === "GET" && !id) return Response.json({ notices: await recentNotices() });
  return Response.json({ error: "Not found." }, { status: 404 });
}

export async function dispatchBoard(method: string, request: Request, path: string[]) {
  try {
    const [resource, id, extra] = path;
    if (!resource || extra) return Response.json({ error: "Not found." }, { status: 404 });
    if (resource === "reminders") return await reminders(method, request, id);
    if (resource === "items") return await items(method, request, id);
    if (resource === "briefings") return await briefings(method, request, id);
    if (resource === "appointments") return await appointments(method, request, id);
    if (resource === "diary") return await diary(method, request, id);
    if (resource === "diary-items") return await diaryItems(method, request, id);
    if (resource === "diary-notes") return await diaryNotes(method, request, id);
    if (resource === "debriefs") return await debriefs(method, request, id);
    if (resource === "notify") return await notifyResource(method, request, id);
    return Response.json({ error: "Not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    console.error(error);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
