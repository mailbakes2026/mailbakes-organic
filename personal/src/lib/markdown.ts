function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function safeHref(href: string) {
  const decoded = href.replaceAll("&amp;", "&");
  if (/^https?:\/\//i.test(decoded) || /^mailto:/i.test(decoded)) return escapeHtml(decoded);
  return "";
}

function inline(value: string) {
  let text = escapeHtml(value);
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
    const url = safeHref(href);
    if (!url) return label;
    return `<a href="${url}" rel="noreferrer">${label}</a>`;
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return text;
}

export function renderMarkdown(source: string) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const html: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (!list) return;
    html.push(`<ul>${list.join("")}</ul>`);
    list = null;
  };
  for (const line of lines) {
    const item = /^(?:-|\*)\s+(.*)$/.exec(line);
    if (item) {
      list ??= [];
      list.push(`<li>${inline(item[1])}</li>`);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    html.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return html.join("");
}
