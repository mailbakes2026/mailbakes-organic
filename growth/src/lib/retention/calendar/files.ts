export const MAX_DESIGN_BYTES = 6_000_000;

export function sniffDesign(bytes: Uint8Array) {
  if (bytes.length === 0) return { ok: false as const, error: "That file is empty." };
  if (bytes.length > MAX_DESIGN_BYTES) return { ok: false as const, error: "Send a PNG, JPG, WebP, or HTML file under 6 MB." };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ok: true as const, mime: "image/png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ok: true as const, mime: "image/jpeg" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ok: true as const, mime: "image/webp" };
  }
  if (looksLikeHtml(bytes)) return { ok: true as const, mime: "text/html" };
  return { ok: false as const, error: "Send a PNG, JPG, WebP, or HTML file." };
}

function looksLikeHtml(bytes: Uint8Array) {
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  if (sample.includes(0)) return false;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(sample).trimStart().slice(0, 800).toLowerCase();
  if (!text.startsWith("<")) return false;
  return /<(?:!doctype|html|head|body|table|div|center)\b/.test(text);
}

export function safeFilename(name: string, mime: string) {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[^\w. -]+/g, "").trim().slice(0, 80);
  if (cleaned) return cleaned;
  if (mime === "text/html") return "design.html";
  if (mime === "image/webp") return "design.webp";
  if (mime === "image/png") return "design.png";
  return "design.jpg";
}
