import { Prisma, type PayslipOutcome } from "@prisma/client";
import { formatDateOnly, formatLongLondonDate, londonWeekCommencing, parseDateOnly } from "@/lib/dates";
import { DriveError, findFileByName, lookupFolder, uploadPdf } from "@/lib/drive";
import { jessEmail, paulEmail } from "@/lib/env";
import { getAccessToken, ReconnectError, SetupError } from "@/lib/google";
import { buildForward, safeFilename, toBase64Url } from "@/lib/mime";
import { cleanFilename, matchPayslips, parseFolderId, payslipNote, type PayslipMatch } from "@/lib/payslip-match";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/shapes";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_PDF = 15 * 1024 * 1024;

type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
  headers?: { name?: string; value?: string }[];
};

type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: GmailPart;
};

export type PayslipPreview = {
  found: boolean;
  messageId: string;
  subject: string;
  receivedAt: string;
  weekOf: string;
  weekLabel: string;
  fromPaul: string;
  files: PayslipMatch[];
  missing: { id: string; name: string }[];
  ignored: string[];
  alreadyFiled: boolean;
};

function decodeBase64Url(value: string) {
  const pad = value.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(pad + "=".repeat((4 - (pad.length % 4)) % 4), "base64");
}

async function gmail(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${GMAIL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) {
    if (response.status === 401) throw new ReconnectError("Google needs connecting again.");
    throw new Error(body.error?.message || `Gmail returned ${response.status}.`);
  }
  return body as Record<string, unknown>;
}

function header(message: GmailMessage, name: string) {
  const headers = message.payload?.headers ?? [];
  return headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

type PdfFile = { attachmentId: string; filename: string; inline?: string };

function walkPdfs(part: GmailPart | undefined, pdfs: PdfFile[], ignored: string[]) {
  if (!part) return;
  const filename = cleanFilename(part.filename || "");
  const pdf = part.mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
  const attachmentId = part.body?.attachmentId;
  const inline = part.body?.data;
  if (part.filename && (attachmentId || inline)) {
    if (pdf) {
      pdfs.push({
        attachmentId: attachmentId || `part:${pdfs.length}:${filename}`,
        filename,
        inline: attachmentId ? undefined : inline,
      });
    } else ignored.push(filename);
  }
  for (const child of part.parts ?? []) walkPdfs(child, pdfs, ignored);
}

function isPayslipMessage(message: GmailMessage) {
  const from = header(message, "From").toLowerCase();
  const subject = header(message, "Subject");
  return from.includes(paulEmail()) && /payslips?/i.test(subject);
}

async function loadStaff() {
  const rows = await prisma.staffFolder.findMany({ orderBy: { name: "asc" } });
  return rows;
}

export async function listStaff() {
  const rows = await loadStaff();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    folderId: row.folderId,
    folderName: row.folderName,
    folderUrl: `https://drive.google.com/drive/folders/${row.folderId}`,
  }));
}

async function saveFolder(name: string, folderInput: string, id?: string) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 80) throw new ValidationError("Enter the person's name.");
  const folderId = parseFolderId(folderInput);
  if (!folderId) throw new ValidationError("Paste the Drive folder link or its id.");
  const existing = await prisma.staffFolder.findMany();
  const clash = existing.find((row) => row.id !== id && row.name.trim().toLowerCase() === cleanName.toLowerCase());
  if (clash) throw new ValidationError("There is already a folder for that name.");
  let folderName = "";
  try {
    const folder = await lookupFolder(folderId);
    folderName = folder.name;
  } catch (error) {
    if (error instanceof SetupError) folderName = "";
    else throw error;
  }
  const data = { name: cleanName, folderId, folderName };
  const row = id
    ? await prisma.staffFolder.update({ where: { id }, data })
    : await prisma.staffFolder.create({ data });
  return {
    id: row.id,
    name: row.name,
    folderId: row.folderId,
    folderName: row.folderName,
    folderUrl: `https://drive.google.com/drive/folders/${row.folderId}`,
  };
}

export async function createStaff(name: string, folder: string) {
  return saveFolder(name, folder);
}

export async function updateStaff(id: string, name: string, folder: string) {
  try {
    return await saveFolder(name, folder, id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
    throw error;
  }
}

export async function deleteStaff(id: string) {
  try {
    await prisma.staffFolder.delete({ where: { id } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return false;
    throw error;
  }
}

export async function detectLatestPayslips(): Promise<PayslipPreview> {
  const empty: PayslipPreview = {
    found: false,
    messageId: "",
    subject: "",
    receivedAt: "",
    weekOf: "",
    weekLabel: "",
    fromPaul: paulEmail(),
    files: [],
    missing: [],
    ignored: [],
    alreadyFiled: false,
  };
  const token = await getAccessToken();
  const query = `from:${paulEmail()} subject:payslip has:attachment newer_than:365d`;
  const listed = (await gmail(token, `/messages?q=${encodeURIComponent(query)}&maxResults=8`)) as {
    messages?: { id: string }[];
  };
  const staff = await loadStaff();
  for (const item of listed.messages ?? []) {
    const message = (await gmail(token, `/messages/${item.id}?format=full`)) as unknown as GmailMessage;
    if (!isPayslipMessage(message)) continue;
    const pdfs: PdfFile[] = [];
    const ignored: string[] = [];
    walkPdfs(message.payload, pdfs, ignored);
    if (pdfs.length === 0) continue;
    const received = message.internalDate ? new Date(Number(message.internalDate)) : new Date();
    const weekOf = londonWeekCommencing(received);
    const matched = matchPayslips(pdfs, staff.map((person) => ({ id: person.id, name: person.name })));
    const prior = await prisma.payslipRun.findFirst({ where: { messageId: message.id }, select: { id: true } });
    return {
      found: true,
      messageId: message.id,
      subject: header(message, "Subject").slice(0, 200),
      receivedAt: received.toISOString(),
      weekOf,
      weekLabel: formatLongLondonDate(weekOf),
      fromPaul: paulEmail(),
      files: matched.files,
      missing: matched.missing,
      ignored,
      alreadyFiled: Boolean(prior),
    };
  }
  return empty;
}

type Assignment = { attachmentId: string; staffId: string | null };

export async function filePayslips(input: { messageId: string; emailJess: boolean; assignments: Assignment[] }) {
  if (!input.messageId) throw new ValidationError("There is no payslips email to file.");
  const token = await getAccessToken();
  const message = (await gmail(token, `/messages/${encodeURIComponent(input.messageId)}?format=full`)) as unknown as GmailMessage;
  if (!isPayslipMessage(message)) throw new ValidationError("That email is not a payslips message from Paul.");
  const pdfs: PdfFile[] = [];
  const ignored: string[] = [];
  walkPdfs(message.payload, pdfs, ignored);
  const staff = await loadStaff();
  const staffById = new Map(staff.map((person) => [person.id, person]));
  const chosen = new Map(input.assignments.map((item) => [item.attachmentId, item.staffId]));
  const auto = matchPayslips(pdfs, staff.map((person) => ({ id: person.id, name: person.name })));
  const autoById = new Map(auto.files.map((file) => [file.attachmentId, file]));

  const planned: {
    attachmentId: string;
    filename: string;
    staffId: string | null;
    staffName: string;
    folderId: string;
  }[] = [];
  const seenStaff = new Set<string>();
  for (const file of pdfs) {
    const staffId = chosen.has(file.attachmentId) ? chosen.get(file.attachmentId) ?? null : autoById.get(file.attachmentId)?.staffId ?? null;
    if (staffId && seenStaff.has(staffId)) throw new ValidationError("Each person can only have one payslip.");
    if (staffId) seenStaff.add(staffId);
    const person = staffId ? staffById.get(staffId) : undefined;
    if (staffId && !person) throw new ValidationError("Choose a person from the list.");
    planned.push({
      attachmentId: file.attachmentId,
      filename: file.filename,
      staffId: person?.id ?? null,
      staffName: person?.name ?? "",
      folderId: person?.folderId ?? "",
    });
  }

  const lines: {
    staffName: string;
    filename: string;
    outcome: PayslipOutcome;
    driveFileId: string;
    detail: string;
    bytes?: Buffer;
  }[] = [];

  for (const file of planned) {
    if (!file.staffId) {
      lines.push({ staffName: "", filename: file.filename, outcome: "UNMATCHED", driveFileId: "", detail: "No person chosen." });
      continue;
    }
    try {
      const source = pdfs.find((item) => item.attachmentId === file.attachmentId);
      const encoded = source?.inline
        ? source.inline
        : ((await gmail(
            token,
            `/messages/${encodeURIComponent(input.messageId)}/attachments/${encodeURIComponent(file.attachmentId)}`,
          )) as { data?: string }).data;
      if (!encoded) throw new DriveError("Gmail did not return that PDF.");
      const bytes = decodeBase64Url(encoded);
      if (bytes.length > MAX_PDF) throw new DriveError("That PDF is over 15MB.");
      const existing = await findFileByName(file.folderId, file.filename);
      if (existing) {
        lines.push({
          staffName: file.staffName,
          filename: file.filename,
          outcome: "SKIPPED_DUPLICATE",
          driveFileId: existing,
          detail: "Already in the folder.",
          bytes,
        });
        continue;
      }
      const driveFileId = await uploadPdf(file.folderId, file.filename, bytes);
      lines.push({
        staffName: file.staffName,
        filename: file.filename,
        outcome: "FILED",
        driveFileId,
        detail: "",
        bytes,
      });
    } catch (error) {
      if (error instanceof ReconnectError || error instanceof SetupError) throw error;
      lines.push({
        staffName: file.staffName,
        filename: file.filename,
        outcome: "FAILED",
        driveFileId: "",
        detail: error instanceof Error ? error.message.slice(0, 180) : "That payslip could not be filed.",
      });
    }
  }

  const filedIds = new Set(planned.filter((file) => file.staffId).map((file) => file.staffId));
  for (const person of staff) {
    if (filedIds.has(person.id)) continue;
    lines.push({ staffName: person.name, filename: "", outcome: "MISSING", driveFileId: "", detail: "No payslip in the email." });
  }

  const received = message.internalDate ? new Date(Number(message.internalDate)) : new Date();
  const weekOf = parseDateOnly(londonWeekCommencing(received))!;
  const weekLabel = formatLongLondonDate(formatDateOnly(weekOf));
  const attach = lines.filter((line) => line.bytes && (line.outcome === "FILED" || line.outcome === "SKIPPED_DUPLICATE"));
  let emailedJess = false;
  let emailError = "";
  if (input.emailJess) {
    if (attach.length === 0) {
      emailError = "Nothing matched, so Jess was not emailed.";
    } else {
      try {
        const account = await prisma.googleAccount.findUnique({ where: { id: "default" } });
        const text = payslipNote({
          weekLabel,
          filed: lines.filter((line) => line.outcome === "FILED").map((line) => ({ name: line.staffName, filename: line.filename })),
          skipped: lines
            .filter((line) => line.outcome === "SKIPPED_DUPLICATE")
            .map((line) => ({ name: line.staffName, filename: line.filename })),
          missing: lines.filter((line) => line.outcome === "MISSING").map((line) => line.staffName),
          unmatched: lines.filter((line) => line.outcome === "UNMATCHED").map((line) => line.filename),
        });
        const raw = buildForward({
          from: account?.email || "millie@mailbakes.com",
          to: jessEmail(),
          subject: `Payslips, week of ${weekLabel}`,
          text,
          attachments: attach.map((line) => ({
            filename: safeFilename(line.filename),
            mimeType: "application/pdf",
            data: line.bytes!,
          })),
        });
        await gmail(token, "/messages/send", {
          method: "POST",
          body: JSON.stringify({ raw: toBase64Url(Buffer.from(raw)) }),
        });
        emailedJess = true;
      } catch (error) {
        if (error instanceof ReconnectError || error instanceof SetupError) throw error;
        emailError = error instanceof Error ? error.message.slice(0, 180) : "The email to Jess could not be sent.";
      }
    }
  }

  const run = await prisma.payslipRun.create({
    data: {
      messageId: input.messageId,
      subject: header(message, "Subject").slice(0, 200),
      receivedAt: received,
      weekOf,
      emailedJess,
      emailError,
      lines: {
        create: lines.map((line) => ({
          staffName: line.staffName,
          filename: line.filename,
          outcome: line.outcome,
          driveFileId: line.driveFileId,
          detail: line.detail,
        })),
      },
    },
    include: { lines: true },
  });
  return {
    id: run.id,
    weekLabel,
    emailedJess,
    emailError,
    jess: jessEmail(),
    lines: run.lines.map(lineDto),
  };
}

function lineDto(line: {
  id: string;
  staffName: string;
  filename: string;
  outcome: PayslipOutcome;
  driveFileId: string;
  detail: string;
}) {
  return {
    id: line.id,
    staffName: line.staffName,
    filename: line.filename,
    outcome: line.outcome,
    driveFileId: line.driveFileId,
    detail: line.detail,
  };
}

export async function listPayslipRuns() {
  const runs = await prisma.payslipRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { lines: true },
  });
  return runs.map((run) => ({
    id: run.id,
    subject: run.subject,
    weekOf: formatDateOnly(run.weekOf),
    weekLabel: formatLongLondonDate(formatDateOnly(run.weekOf)),
    receivedAt: run.receivedAt.toISOString(),
    createdAt: run.createdAt.toISOString(),
    emailedJess: run.emailedJess,
    emailError: run.emailError,
    lines: run.lines.map(lineDto),
  }));
}
