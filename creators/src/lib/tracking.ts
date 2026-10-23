export function safeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Royal Mail tracking, when the courier is blank or Royal Mail. */
export function royalMailTrackUrl(tracking: string, courier: string): string | null {
  const number = tracking.trim();
  if (!number) return null;
  const who = courier.trim().toLowerCase();
  if (who && !who.includes("royal")) return null;
  const compact = number.replace(/\s+/g, "");
  return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(compact)}`;
}
