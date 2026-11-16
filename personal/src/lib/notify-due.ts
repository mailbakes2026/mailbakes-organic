// Notifications this app raises itself, from the 15-minute cron:
//  - appointments: the same "today" / "tomorrow" moments as the emails
//  - reminders: one morning nudge listing what's due or overdue
import { describeWhen, findDueReminders } from "@/lib/appointments";
import { londonParts, londonToday } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { notify, pruneNotices } from "@/lib/notify";
import { listReminders } from "@/lib/records";

export async function notifyDue(now = new Date()) {
  let raised = 0;
  for (const { row, clean, kind } of await findDueReminders(now)) {
    const label = kind === "morning" ? "Today" : "Tomorrow";
    const result = await notify({
      source: "appointments",
      key: `appointments:${row.id}:${kind}:${clean.startDay}`,
      title: `${label}: ${clean.title}${clean.allDay ? "" : ` at ${clean.startTime}`}`,
      body: [describeWhen(clean), clean.location ? `Where: ${clean.location}` : ""].filter(Boolean).join(" · "),
      url: `${appUrl()}/calendar?week=${clean.startDay}`,
    });
    if (result.pushed) raised += 1;
  }

  // One reminders nudge a day, from 8am London time.
  const today = londonToday(now);
  if (londonParts(now).hour >= 8) {
    const due = (await listReminders()).filter((r) => !r.done && r.dueOn <= today);
    if (due.length) {
      const titles = due.slice(0, 4).map((r) => r.title);
      const more = due.length > 4 ? ` and ${due.length - 4} more` : "";
      const result = await notify({
        source: "reminders",
        key: `reminders:daily:${today}`,
        title: due.length === 1 ? "1 reminder for today" : `${due.length} reminders for today`,
        body: `${titles.join(" · ")}${more}`,
        url: `${appUrl()}/diary`,
      });
      if (result.pushed) raised += 1;
    }
  }
  await pruneNotices(now).catch(() => undefined);
  return { raised };
}
