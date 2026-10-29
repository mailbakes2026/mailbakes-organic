import { DiaryBoard } from "@/components/diary-board";
import { londonToday, parseDateOnly } from "@/lib/dates";
import { pullDebriefs } from "@/lib/debrief-pull";
import { loadDiaryDay } from "@/lib/diary";

export const dynamic = "force-dynamic";

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const params = await searchParams;
  const today = londonToday();
  const day = typeof params.day === "string" && parseDateOnly(params.day) ? params.day : today;
  // Today's debriefs refresh when the diary opens, at most every 30 minutes.
  if (day === today) await pullDebriefs(new Date(), { onlyIfStale: true }).catch(() => null);
  const diary = await loadDiaryDay(day);
  return <DiaryBoard diary={diary} />;
}
