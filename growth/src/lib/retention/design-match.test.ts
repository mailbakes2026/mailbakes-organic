import assert from "node:assert/strict";
import test from "node:test";
import { accountRate, matchCampaignDesign, type DesignLink } from "./design-match.ts";

const rows: DesignLink[] = [
  {
    calendarId: "cal-1",
    title: "Secret slice",
    klaviyoCampaignId: "abc123456",
    sendDate: "2026-11-24",
    audience: "Engaged",
    subject: "A slice",
    design: { id: "d1", mimeType: "image/png", filename: "slice.png" },
  },
  {
    calendarId: "cal-2",
    title: "Sunday letter",
    klaviyoCampaignId: "",
    sendDate: "2026-11-22",
    audience: "",
    subject: "",
    design: null,
  },
  {
    calendarId: "cal-3",
    title: "Sunday letter",
    klaviyoCampaignId: "",
    sendDate: "2026-11-29",
    audience: "All",
    subject: "Hello",
    design: { id: "d3", mimeType: "text/html", filename: "letter.html" },
  },
];

test("a Klaviyo id wins, then a title that already has a design", () => {
  assert.equal(matchCampaignDesign({ id: "abc123456", name: "Something else" }, rows)?.calendarId, "cal-1");
  assert.equal(matchCampaignDesign({ id: "other", name: "  sunday   letter " }, rows)?.calendarId, "cal-3");
  assert.equal(matchCampaignDesign({ id: "missing", name: "No such send" }, rows), null);
});

test("the account rate weights by recipients when every row has them", () => {
  const rate = accountRate([
    { delivered: 10, rate: 0.5 },
    { delivered: 30, rate: 0.1 },
  ]);
  assert.equal(rate, (0.5 * 10 + 0.1 * 30) / 40);
  assert.equal(accountRate([{ delivered: null, rate: null }]), null);
});
