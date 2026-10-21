import assert from "node:assert/strict";
import test from "node:test";
import { calendarLane, classifyEmail } from "./classify.ts";

const domains = ["bakedflour.co.uk"];

test("an invoice is an invoice even when it is from MailBakes", () => {
  assert.equal(
    classifyEmail({
      fromEmail: "accounts@mailbakes.com",
      subject: "VAT invoice 1044",
      snippet: "Please pay",
      attachmentNames: [],
      supplierDomains: domains,
    }),
    "INVOICES",
  );
});

test("a PDF named invoice is an invoice", () => {
  assert.equal(
    classifyEmail({
      fromEmail: "billing@bakedflour.co.uk",
      subject: "Documents",
      snippet: "",
      attachmentNames: ["Invoice-88.pdf"],
      supplierDomains: domains,
    }),
    "INVOICES",
  );
});

test("a listed supplier domain is Suppliers", () => {
  assert.equal(
    classifyEmail({
      fromEmail: "orders@bakedflour.co.uk",
      subject: "Hello",
      snippet: "",
      attachmentNames: [],
      supplierDomains: domains,
    }),
    "SUPPLIERS",
  );
});

test("an order confirmation is Suppliers", () => {
  assert.equal(
    classifyEmail({
      fromEmail: "shop@example.com",
      subject: "Your order has dispatched",
      snippet: "",
      attachmentNames: [],
      supplierDomains: [],
    }),
    "SUPPLIERS",
  );
});

test("mail from the bakery is MailBakes", () => {
  assert.equal(
    classifyEmail({
      fromEmail: "studio@mailbakes.com",
      subject: "Friday tasting",
      snippet: "",
      attachmentNames: [],
      supplierDomains: [],
    }),
    "MAILBAKES",
  );
});

test("everything else is personal", () => {
  assert.equal(
    classifyEmail({
      fromEmail: "mum@gmail.com",
      subject: "Dinner on Sunday",
      snippet: "Are you free?",
      attachmentNames: [],
      supplierDomains: domains,
    }),
    "PERSONAL",
  );
});

test("calendar names split into MailBakes and Personal", () => {
  const hints = ["personal", "home", "private", "family"];
  assert.equal(calendarLane("MailBakes", hints), "mailbakes");
  assert.equal(calendarLane("Millie personal", hints), "personal");
  assert.equal(calendarLane("Home", hints), "personal");
});
