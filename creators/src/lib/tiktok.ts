const USERNAME = /^[A-Za-z0-9._]{2,24}$/;

export type HandleResult = { ok: true; value: string } | { ok: false; error: string };

function cleanUsername(value: string): string | null {
  if (!USERNAME.test(value)) return null;
  if (value.startsWith(".") || value.endsWith(".")) return null;
  return value;
}

function usernameFromProfileUrl(raw: string): string | null {
  let candidate = raw.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^(?:www\.|m\.)?tiktok\.com\//i.test(candidate)) candidate = `https://${candidate}`;
    else return null;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host !== "tiktok.com" && host !== "www.tiktok.com" && host !== "m.tiktok.com") return null;
  const match = url.pathname.match(/^\/@([^/]+)/);
  if (!match) return null;
  let decoded = match[1];
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return cleanUsername(decoded);
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^(?:www\.|m\.)?tiktok\.com\//i.test(value);
}

/** Turn a handle or a TikTok profile URL into @handle. Other text is kept as typed. */
export function normaliseHandle(raw: string): HandleResult {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: true, value: "" };
  if (looksLikeUrl(trimmed)) {
    const username = usernameFromProfileUrl(trimmed);
    if (!username) {
      return { ok: false, error: "Paste a TikTok profile link, like https://www.tiktok.com/@handle." };
    }
    return { ok: true, value: `@${username}` };
  }
  const stripped = trimmed.replace(/^@+\s*/, "");
  const username = cleanUsername(stripped);
  if (username) return { ok: true, value: `@${username}` };
  if (trimmed.length > 80) return { ok: false, error: "TikTok handle is too long." };
  return { ok: true, value: trimmed };
}

/** Profile URL for a stored handle. Blank and non-handles such as "Samantha Starr" have none. */
export function tiktokProfileUrl(raw: string): string | null {
  const result = normaliseHandle(raw);
  if (!result.ok || !result.value.startsWith("@")) return null;
  const username = cleanUsername(result.value.slice(1));
  if (!username) return null;
  return `https://www.tiktok.com/@${username}`;
}
