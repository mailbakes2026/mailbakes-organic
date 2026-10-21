import { DRIVE_SCOPE, getAccessToken, hasDriveScope, ReconnectError, SetupError } from "@/lib/google";
import { prisma } from "@/lib/prisma";

const DRIVE = "https://www.googleapis.com/drive/v3";

export class DriveError extends Error {}

async function token() {
  const row = await prisma.googleAccount.findUnique({ where: { id: "default" } });
  if (!row?.refreshTokenEnc) throw new SetupError("Connect Google before filing payslips.");
  if (!hasDriveScope(row.scopes)) {
    throw new SetupError("Connect Google again so payslips can be filed in Drive.");
  }
  return getAccessToken();
}

async function drive(access: string, path: string, init?: RequestInit) {
  const response = await fetch(`${DRIVE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${access}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
  if (!response.ok) {
    const message = body.error?.message || `Google Drive returned ${response.status}.`;
    if (response.status === 401 || body.error?.status === "PERMISSION_DENIED") {
      throw new ReconnectError("Connect Google again so payslips can be filed in Drive.");
    }
    throw new DriveError(message.slice(0, 180));
  }
  return body as Record<string, unknown>;
}

export async function lookupFolder(folderId: string) {
  const access = await token();
  const body = (await drive(
    access,
    `/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`,
  )) as { id?: string; name?: string; mimeType?: string };
  if (body.mimeType !== "application/vnd.google-apps.folder" || !body.id) {
    throw new DriveError("That link is not a Drive folder.");
  }
  return { id: body.id, name: body.name?.slice(0, 200) || "Folder" };
}

function quote(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function findFileByName(folderId: string, filename: string) {
  const access = await token();
  const q = `name = '${quote(filename)}' and '${quote(folderId)}' in parents and trashed = false`;
  const body = (await drive(
    access,
    `/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  )) as { files?: { id: string }[] };
  return body.files?.[0]?.id ?? null;
}

export async function uploadPdf(folderId: string, filename: string, data: Buffer) {
  const access = await token();
  const boundary = `mb_${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name: filename, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const uploaded = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string; status?: string } };
  if (!response.ok || !uploaded.id) {
    if (response.status === 401 || uploaded.error?.status === "PERMISSION_DENIED") {
      throw new ReconnectError("Connect Google again so payslips can be filed in Drive.");
    }
    throw new DriveError((uploaded.error?.message || "Drive did not store that payslip.").slice(0, 180));
  }
  return uploaded.id;
}

export { DRIVE_SCOPE };
