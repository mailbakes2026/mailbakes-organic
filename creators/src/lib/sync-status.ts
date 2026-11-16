export type TiktokSync = { at: string; ok: boolean; message: string };

/** What the pipeline shows for the latest TikTok order pull. A missing sync is not a success. */
export function describeSync(sync: TiktokSync | null) {
  if (!sync) return { ok: false as const, text: "TikTok orders have not synced yet." };
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(sync.at));
  if (!sync.ok) return { ok: false as const, text: `${sync.message} Last synced ${when}.` };
  return { ok: true as const, text: `Last synced ${when}. ${sync.message}` };
}
