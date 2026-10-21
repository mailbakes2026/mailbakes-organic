import assert from "node:assert/strict";
import test from "node:test";
import { buildForward, encodeSubject, toBase64Url } from "./mime.ts";

test("encodes a subject that is not plain ASCII", () => {
  assert.match(encodeSubject("Facture — café"), /^=\?UTF-8\?B\?/);
  assert.equal(encodeSubject("Invoice 12"), "Invoice 12");
});

test("a forward keeps the recipient, subject and attachment bytes", () => {
  const raw = buildForward({
    from: "millie@mailbakes.com",
    to: "accounts@mailbakes.com",
    subject: "Fwd: Invoice 12",
    text: "Forwarded to finance.",
    attachments: [{ filename: "invoice.pdf", mimeType: "application/pdf", data: Buffer.from("pdf-bytes") }],
  });
  assert.match(raw, /To: accounts@mailbakes.com/);
  assert.match(raw, /Subject: Fwd: Invoice 12/);
  assert.match(raw, /filename="invoice.pdf"/);
  assert.match(raw, new RegExp(Buffer.from("pdf-bytes").toString("base64")));
  const encoded = toBase64Url(Buffer.from(raw));
  assert.equal(encoded.includes("+"), false);
  assert.equal(encoded.includes("/"), false);
});
