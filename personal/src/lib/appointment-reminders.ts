// Sends the email reminders for Millie's own appointments, from her own Gmail
// to herself. Called every 15 minutes by the Render cron job (see render.yaml).
import { claimReminder, describeWhen, findDueReminders, releaseReminder } from "@/lib/appointments";
import { appUrl, expectedGmail } from "@/lib/env";
import { connectedEmail, getAccessToken, ReconnectError } from "@/lib/google";
import { encodeSubject, toBase64Url } from "@/lib/mime";

const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

function plainEmail(to: string, subject: string, text: string) {
  return [
    `From: ${to}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
}

export async function sendDueReminders(now = new Date()) {
  const due = await findDueReminders(now);
  if (due.length === 0) return { sent: 0, failed: 0, errors: [] as string[] };

  const token = await getAccessToken();
  const to = (await connectedEmail()) || expectedGmail();
  let sent = 0;
  const errors: string[] = [];

  for (const { row, clean, kind } of due) {
    // Claim first, so an overlapping run can't send the same reminder twice.
    if (!(await claimReminder(row.id, kind, now))) continue;
    const label = kind === "morning" ? "Today" : "Tomorrow";
    const when = describeWhen(clean);
    const subject = `${label}: ${clean.title}${clean.allDay ? "" : ` at ${clean.startTime}`}`;
    const lines = [`${clean.title} (${clean.type})`, when];
    if (clean.location) lines.push(`Where: ${clean.location}`);
    if (clean.notes) lines.push(`Notes: ${clean.notes}`);
    lines.push("", `Calendar: ${appUrl()}/calendar?week=${clean.startDay}`);
    try {
      const response = await fetch(SEND_URL, {
        method: "POST",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: toBase64Url(Buffer.from(plainEmail(to, subject, lines.join("\n")))) }),
      });
      if (response.status === 401) throw new ReconnectError("Google needs connecting again.");
      if (!response.ok) throw new Error(`Gmail returned ${response.status}.`);
      sent += 1;
    } catch (error) {
      // Give it back so the next run can try again while the window is open.
      await releaseReminder(row.id, kind);
      if (error instanceof ReconnectError) throw error;
      console.error(error);
      errors.push(`${clean.title}: ${error instanceof Error ? error.message : "could not send"}`);
    }
  }
  return { sent, failed: errors.length, errors };
}
