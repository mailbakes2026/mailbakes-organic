export type EmailGroupName = "MAILBAKES" | "SUPPLIERS" | "INVOICES" | "PERSONAL";

const INVOICE = /\b(invoice|receipt|credit note|remittance|payment due|amount due|vat invoice)\b/i;
const SUPPLIER = /\b(order confirmation|dispatched|dispatch|delivery note|your order|wholesale|supplier|purchase order)\b/i;

export function classifyEmail(input: {
  fromEmail: string;
  subject: string;
  snippet: string;
  attachmentNames: string[];
  supplierDomains: string[];
}): EmailGroupName {
  const haystack = [input.subject, input.snippet, ...input.attachmentNames].join("\n");
  if (INVOICE.test(haystack)) return "INVOICES";
  const domain = input.fromEmail.split("@")[1]?.toLowerCase() ?? "";
  const listed = input.supplierDomains.some((item) => item && (domain === item || domain.endsWith(`.${item}`)));
  if (listed || SUPPLIER.test(haystack)) return "SUPPLIERS";
  if (domain === "mailbakes.com" || /mailbakes/i.test(haystack) || /mailbakes/i.test(input.fromEmail)) {
    return "MAILBAKES";
  }
  return "PERSONAL";
}

export function calendarLane(name: string, hints: string[]): "mailbakes" | "personal" {
  const text = name.toLowerCase();
  if (hints.some((hint) => hint && text.includes(hint))) return "personal";
  return "mailbakes";
}

export const GROUP_ORDER: EmailGroupName[] = ["MAILBAKES", "SUPPLIERS", "INVOICES", "PERSONAL"];

export const GROUP_LABEL: Record<EmailGroupName, string> = {
  MAILBAKES: "MailBakes",
  SUPPLIERS: "Suppliers",
  INVOICES: "Invoices",
  PERSONAL: "Personal",
};
