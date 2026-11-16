/** Horizontal vs vertical finger movement. Null until the gesture is past the slop. */
export function swipeAxis(dx: number, dy: number, slop = 8): "horizontal" | "vertical" | null {
  if (Math.hypot(dx, dy) < slop) return null;
  return Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
}

/** -1 is the previous slide, 1 is the next. 0 means the finger did not travel far enough. */
export function swipeStep(dx: number, threshold = 48): -1 | 0 | 1 {
  if (dx > threshold) return -1;
  if (dx < -threshold) return 1;
  return 0;
}

export type ByteRange = { start: number; end: number };

/**
 * A single `Range: bytes=` request. Phone video players ask for ranges;
 * without a 206 they often open the file URL instead of playing inline.
 * Returns null when the header is absent or not a single byte range.
 */
export function parseByteRange(header: string | null, size: number): ByteRange | "unsatisfiable" | null {
  if (!header || size < 0) return null;
  const first = header.split(",")[0]?.trim() ?? "";
  const match = /^bytes=(\d*)-(\d*)$/i.exec(first);
  if (!match || size === 0) return null;
  const startRaw = match[1] ?? "";
  const endRaw = match[2] ?? "";
  if (startRaw === "" && endRaw === "") return null;

  if (startRaw === "") {
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const start = Math.max(0, size - suffix);
    return { start, end: size - 1 };
  }

  const start = Number(startRaw);
  if (!Number.isFinite(start) || start < 0) return null;
  if (start >= size) return "unsatisfiable";
  const end = endRaw === "" ? size - 1 : Number(endRaw);
  if (!Number.isFinite(end) || end < start) return "unsatisfiable";
  return { start, end: Math.min(end, size - 1) };
}

export function mediaByteResponse(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
  rangeHeader: string | null,
): Response {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const size = bytes.byteLength;
  const headers: Record<string, string> = {
    "Content-Type": mimeType,
    "Content-Disposition": `inline; filename="${safe}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  const range = parseByteRange(rangeHeader, size);
  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${size}` },
    });
  }
  if (range) {
    const chunk = bytes.subarray(range.start, range.end + 1);
    return new Response(chunk.slice(), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(chunk.byteLength),
      },
    });
  }
  return new Response(bytes.slice(), {
    status: 200,
    headers: { ...headers, "Content-Length": String(size) },
  });
}

export type VideoPreview = {
  kind: "file" | "iframe";
  src: string;
  title: string;
  shape: "wide" | "tall";
};

function youtubeId(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    return url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] || "";
  }
  return "";
}

/** An in-app player for a creative video link. Other notes stay plain text. */
export function videoPreviewFor(raw: string): VideoPreview | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  const youtube = youtubeId(url);
  if (youtube && /^[\w-]{6,}$/.test(youtube)) {
    const tall = /\/shorts\//.test(url.pathname);
    return {
      kind: "iframe",
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtube)}`,
      title: "YouTube",
      shape: tall ? "tall" : "wide",
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).pop() ?? "";
    if (/^\d+$/.test(id)) {
      return { kind: "iframe", src: `https://player.vimeo.com/video/${id}`, title: "Vimeo", shape: "wide" };
    }
  }

  if (host === "loom.com") {
    const id = url.pathname.match(/\/(?:share|embed)\/([^/?#]+)/)?.[1] ?? "";
    if (id) return { kind: "iframe", src: `https://www.loom.com/embed/${id}`, title: "Loom", shape: "wide" };
  }

  if (host === "drive.google.com") {
    const id = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id") || "";
    if (id) {
      return {
        kind: "iframe",
        src: `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`,
        title: "Google Drive",
        shape: "wide",
      };
    }
  }

  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const id = url.pathname.match(/\/video\/(\d+)/)?.[1] ?? "";
    if (id) return { kind: "iframe", src: `https://www.tiktok.com/embed/v2/${id}`, title: "TikTok", shape: "tall" };
  }

  if (host === "instagram.com") {
    const match = url.pathname.match(/\/(reel|p|tv)\/([^/?#]+)/);
    if (match) {
      return {
        kind: "iframe",
        src: `https://www.instagram.com/${match[1]}/${match[2]}/embed`,
        title: "Instagram",
        shape: "tall",
      };
    }
  }

  if (host === "dropbox.com" && /\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test(url.pathname)) {
    const playable = new URL(url.toString());
    playable.searchParams.set("raw", "1");
    playable.searchParams.delete("dl");
    return { kind: "file", src: playable.toString(), title: "Dropbox", shape: "wide" };
  }

  if (/\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test(url.pathname)) {
    return { kind: "file", src: url.toString(), title: "Video", shape: "wide" };
  }

  return null;
}

export function creativeVideoSources(text: string): VideoPreview[] {
  const found = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const previews: VideoPreview[] = [];
  const seen = new Set<string>();
  for (const raw of found) {
    const trimmed = raw.replace(/[),.;]+$/g, "");
    const preview = videoPreviewFor(trimmed);
    if (!preview || seen.has(preview.src)) continue;
    seen.add(preview.src);
    previews.push(preview);
  }
  return previews;
}
