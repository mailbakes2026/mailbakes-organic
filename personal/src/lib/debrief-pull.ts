// Fetches today's summary from each MailBakes app and files it as a debrief.
// Read-only: it only GETs each app's token-protected summary.
import { londonToday } from "@/lib/dates";
import { saveDebrief } from "@/lib/diary";
import {
  conversionDebrief,
  financeDebrief,
  operationsDebrief,
  organicDebrief,
  type DebriefInput,
} from "@/lib/diary-rules";
import { prisma } from "@/lib/prisma";

type Source = {
  name: string;
  url: string;
  token: string;
  build: (summary: unknown, day: string) => DebriefInput | null;
};

function env(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function base(name: string) {
  return env(name).replace(/\/$/, "");
}

/** Each source is skipped quietly until its address and token are set on Render. */
export function configuredSources(): Source[] {
  const sources: Source[] = [
    { name: "finance", url: base("FINANCE_BASE_URL") && `${base("FINANCE_BASE_URL")}/api/v1/summary`, token: env("FINANCE_API_TOKEN"), build: financeDebrief },
    { name: "operations", url: env("OPS_SUMMARY_URL"), token: env("OPS_API_TOKEN"), build: operationsDebrief },
    { name: "organic", url: env("ORGANIC_SUMMARY_URL"), token: env("ORGANIC_API_TOKEN"), build: organicDebrief },
    { name: "conversion", url: env("CONVERSION_SUMMARY_URL"), token: env("CONVERSION_API_TOKEN"), build: conversionDebrief },
  ];
  return sources.filter((source) => source.url && source.token);
}

export type PullResult = { day: string; saved: string[]; failed: string[]; skipped: boolean };

const STALE_MS = 30 * 60 * 1000;

/** Pull every configured app. With onlyIfStale, does nothing if a pull ran in the last 30 minutes. */
export async function pullDebriefs(now = new Date(), options: { onlyIfStale?: boolean } = {}): Promise<PullResult> {
  const day = londonToday(now);
  if (options.onlyIfStale) {
    const latest = await prisma.debrief.findFirst({
      where: { kind: "daily", source: { in: ["finance", "operations", "organic", "conversion"] } },
      orderBy: { receivedAt: "desc" },
    });
    if (latest && now.getTime() - latest.receivedAt.getTime() < STALE_MS) return { day, saved: [], failed: [], skipped: true };
  }
  const saved: string[] = [];
  const failed: string[] = [];
  await Promise.all(
    configuredSources().map(async (source) => {
      try {
        const response = await fetch(source.url, {
          headers: { Authorization: `Bearer ${source.token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`${source.name} replied ${response.status}`);
        const debrief = source.build(await response.json(), day);
        if (debrief) {
          await saveDebrief(debrief);
          saved.push(source.name);
        }
      } catch (error) {
        console.error("debrief pull", source.name, error instanceof Error ? error.message : error);
        failed.push(source.name);
      }
    }),
  );
  return { day, saved, failed, skipped: false };
}
