import { BriefingsBoard } from "@/components/briefings-board";
import { londonToday } from "@/lib/dates";
import { listBriefings } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function BriefingsPage() {
  const briefings = await listBriefings();
  return <BriefingsBoard briefings={briefings} today={londonToday()} />;
}