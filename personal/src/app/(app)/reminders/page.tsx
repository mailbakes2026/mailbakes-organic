import { RemindersBoard } from "@/components/reminders-board";
import { londonToday } from "@/lib/dates";
import { listReminders } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const reminders = await listReminders();
  return <RemindersBoard reminders={reminders} today={londonToday()} />;
}
