import { randomBytes } from "node:crypto";

export function wrapBase64(value: string) {
  const lines: string[] = [];
  for (let index = 0; index < value.length; index += 76) lines.push(value.slice(index, index + 76));
  return lines.join("\r\n");
}

export function encodeSubject(subject: string) {
  const clean = subject.replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

export function safeFilename(name: string) {
  const cleaned = name.replace(/[\r\n"]/g, "").replace(/[^\x20-\x7E]/g, "_").trim();
  return (cleaned || "attachment").slice(0, 180);
}

export function toBase64Url(bytes: Buffer) {
  return bytes.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function buildForward(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: { filename: string; mimeType: string; data: Buffer }[];
}) {
  const boundary = `mb_${randomBytes(12).toString("hex")}`;
  const chunks = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeSubject(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(input.text, "utf8").toString("base64")),
  ];
  for (const file of input.attachments) {
    const filename = safeFilename(file.filename);
    const mime = file.mimeType.replace(/[\r\n;"]/g, "") || "application/octet-stream";
    chunks.push(
      `--${boundary}`,
      `Content-Type: ${mime}; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(file.data.toString("base64")),
    );
  }
  chunks.push(`--${boundary}--`, "");
  return chunks.join("\r\n");
}
