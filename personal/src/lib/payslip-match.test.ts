import assert from "node:assert/strict";
import test from "node:test";
import { buildForward } from "./mime.ts";
import { matchPayslips, parseFolderId, payslipNote } from "./payslip-match.ts";

const staff = [
  { id: "jess", name: "Jess Smith" },
  { id: "paul", name: "Paul Adeyemi" },
  { id: "sam", name: "Sam Lee" },
  { id: "samantha", name: "Samantha Lee" },
];

test("reads a Drive folder id from a link or a bare id", () => {
  assert.equal(parseFolderId("https://drive.google.com/drive/folders/1AbCdefGHIjklMNOpqrst"), "1AbCdefGHIjklMNOpqrst");
  assert.equal(parseFolderId("https://drive.google.com/drive/u/0/folders/1AbCdefGHIjklMNOpqrst?usp=sharing"), "1AbCdefGHIjklMNOpqrst");
  assert.equal(parseFolderId("https://drive.google.com/open?id=1AbCdefGHIjklMNOpqrst"), "1AbCdefGHIjklMNOpqrst");
  assert.equal(parseFolderId("1AbCdefGHIjklMNOpqrst"), "1AbCdefGHIjklMNOpqrst");
  assert.equal(parseFolderId("not a folder"), null);
});

test("matches a payslip PDF to a person by name and flags the gaps", () => {
  const result = matchPayslips(
    [
      { attachmentId: "a", filename: "Payslip - Jess Smith.pdf" },
      { attachmentId: "b", filename: "paul-adeyemi.pdf" },
      { attachmentId: "c", filename: "mystery.pdf" },
      { attachmentId: "d", filename: "Sam Lee payslip.pdf" },
    ],
    staff,
  );
  const byFile = Object.fromEntries(result.files.map((file) => [file.attachmentId, file]));
  assert.equal(byFile.a.state, "matched");
  assert.equal(byFile.a.staffId, "jess");
  assert.equal(byFile.b.staffId, "paul");
  assert.equal(byFile.c.state, "unmatched");
  assert.equal(byFile.d.staffId, "sam");
  assert.deepEqual(
    result.missing.map((person) => person.id),
    ["samantha"],
  );
});

test("gives a person only one PDF and leaves the extra unmatched", () => {
  const result = matchPayslips(
    [
      { attachmentId: "a", filename: "Jess Smith payslip.pdf" },
      { attachmentId: "b", filename: "Jess Smith October.pdf" },
    ],
    [{ id: "jess", name: "Jess Smith" }],
  );
  assert.equal(result.files[0].staffId, "jess");
  assert.equal(result.files[1].state, "unmatched");
  assert.equal(result.missing.length, 0);
});

test("does not guess when two people fit one filename", () => {
  const result = matchPayslips([{ attachmentId: "a", filename: "Alex Ray payslip.pdf" }], [
    { id: "a", name: "Alex Ray" },
    { id: "b", name: "Ray Alex" },
  ]);
  assert.equal(result.files[0].state, "ambiguous");
  assert.equal(result.files[0].staffId, null);
  assert.equal(result.missing.length, 2);
});

test("the note to Jess is a new message and has no personal details", () => {
  const text = payslipNote({
    weekLabel: "19 October 2026",
    filed: [{ name: "Jess Smith", filename: "Jess Smith.pdf" }],
    skipped: [],
    missing: ["Samantha Lee"],
    unmatched: ["mystery.pdf"],
  });
  assert.match(text, /Jess Smith — Jess Smith\.pdf/);
  assert.match(text, /Samantha Lee/);
  assert.match(text, /not a reply or a forward/i);
  assert.equal(/sort code|account number|emergency|phone|fwd:|in-reply-to/i.test(text), false);
  const raw = buildForward({
    from: "millie@mailbakes.com",
    to: "operations@mailbakes.com",
    subject: "Payslips, week of 19 October 2026",
    text,
    attachments: [{ filename: "Jess Smith.pdf", mimeType: "application/pdf", data: Buffer.from("%PDF") }],
  });
  assert.equal(/in-reply-to|references:/i.test(raw), false);
  assert.match(raw, /To: operations@mailbakes.com/);
  assert.equal(raw.includes("accounts@mailbakes.com"), false);
});
