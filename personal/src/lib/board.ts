import { sendDueReminders } from "@/lib/appointment-reminders";
import {
  createAppointment,
  deleteAppointment,
  getAppointment,
  importAppointments,
  listAppointments,
  updateAppointment,
} from "@/lib/appointments";
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
    try {
      return Response.json(await sendDueReminders());
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

export async function dispatchBoard(method: string, request: Request, path: string[]) {
  try {
    const [resource, id, extra] = path;
    if (!resource || extra) return Response.json({ error: "Not found." }, { status: 404 });
    if (resource === "reminders") return await reminders(method, request, id);
    if (resource === "items") return await items(method, request, id);
    if (resource === "briefings") return await briefings(method, request, id);
    if (resource === "appointments") return await appointments(method, request, id);
    return Response.json({ error: "Not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    console.error(error);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
