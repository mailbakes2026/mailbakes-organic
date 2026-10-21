export type StaffRef = { id: string; name: string };
export type PdfRef = { attachmentId: string; filename: string };

export type PayslipMatch = {
  attachmentId: string;
  filename: string;
  staffId: string | null;
  staffName: string;
  state: "matched" | "unmatched" | "ambiguous";
};

export function cleanFilename(name: string) {
  const base = name.replace(/[\r\n\0]/g, "").replace(/[/\\]/g, "-").trim();
  return (base || "payslip.pdf").slice(0, 180);
}

export function parseFolderId(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromUrl = folderIdFromUrl(trimmed);
  if (fromUrl) return fromUrl;
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

function folderIdFromUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const folder = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folder) return folder[1];
  const id = url.searchParams.get("id");
  if (id && /^[a-zA-Z0-9_-]{10,}$/.test(id)) return id;
  return null;
}

export function normaliseLabel(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/payslips?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string) {
  return normaliseLabel(value).split(" ").filter((token) => token.length >= 2);
}

export function matchPayslips(files: PdfRef[], staff: StaffRef[]) {
  const prepared = staff
    .map((person) => ({ ...person, tokens: tokens(person.name) }))
    .filter((person) => person.tokens.length > 0);
  const used = new Set<string>();
  const matched: PayslipMatch[] = files.map((file) => {
    const fileTokens = new Set(tokens(file.filename));
    const candidates = prepared.filter(
      (person) => !used.has(person.id) && person.tokens.every((token) => fileTokens.has(token)),
    );
    const best = candidates.reduce((max, person) => Math.max(max, person.tokens.length), 0);
    const winners = candidates.filter((person) => person.tokens.length === best);
    if (winners.length === 1) {
      used.add(winners[0].id);
      return {
        attachmentId: file.attachmentId,
        filename: cleanFilename(file.filename),
        staffId: winners[0].id,
        staffName: winners[0].name,
        state: "matched" as const,
      };
    }
    return {
      attachmentId: file.attachmentId,
      filename: cleanFilename(file.filename),
      staffId: null,
      staffName: "",
      state: winners.length > 1 ? ("ambiguous" as const) : ("unmatched" as const),
    };
  });
  const missing = staff.filter((person) => !used.has(person.id)).map((person) => ({ id: person.id, name: person.name }));
  return { files: matched, missing };
}

export function payslipNote(input: {
  weekLabel: string;
  filed: { name: string; filename: string }[];
  skipped: { name: string; filename: string }[];
  missing: string[];
  unmatched: string[];
}) {
  const lines = [
    `Payslips for the week of ${input.weekLabel}.`,
    "",
    "Filed in each person's Drive folder:",
  ];
  if (input.filed.length === 0) lines.push("- None");
  for (const file of input.filed) lines.push(`- ${file.name} — ${file.filename}`);
  if (input.skipped.length > 0) {
    lines.push("", "Already in the folder, so not uploaded again:");
    for (const file of input.skipped) lines.push(`- ${file.name} — ${file.filename}`);
  }
  if (input.missing.length > 0) {
    lines.push("", "No payslip in the email:");
    for (const name of input.missing) lines.push(`- ${name}`);
  }
  if (input.unmatched.length > 0) {
    lines.push("", "PDFs that were not matched to a person, and were not filed or attached:");
    for (const filename of input.unmatched) lines.push(`- ${filename}`);
  }
  lines.push("", "This is a new email. It is not a reply or a forward.");
  return lines.join("\n");
}
