const MAX_HTML = 200_000;

export function sanitizeEmailHtml(raw: string) {
  if (!raw) return "";
  let html = raw.replace(/^\uFEFF/, "").slice(0, MAX_HTML);
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  html = html.replace(/<\/?(?:iframe|object|embed|form|base|link|meta|script)\b[^>]*>/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/\s(?:href|src|srcdoc|action)\s*=\s*(['"])\s*(?:javascript|data):[\s\S]*?\1/gi, "");
  html = html.replace(/expression\s*\(/gi, "");
  return html.trim();
}
