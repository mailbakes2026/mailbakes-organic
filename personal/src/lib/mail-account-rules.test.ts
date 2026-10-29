import assert from "node:assert/strict";
import test from "node:test";
import {
  boardId,
  cleanAppPassword,
  cleanGmailInput,
  gmailWebLink,
  microsoftAuthUrl,
  parseSender,
} from "./mail-account-rules.ts";

test("app password accepts Google's spaced format and rejects normal passwords", () => {
  assert.equal(cleanAppPassword("abcd efgh ijkl mnop"), "abcdefghijklmnop");
  assert.equal(cleanAppPassword("ABCDEFGHIJKLMNOP"), "abcdefghijklmnop");
  assert.throws(() => cleanAppPassword("myNormalPassw0rd!"), /16-letter app password/);
  assert.throws(() => cleanAppPassword(""), /16-letter/);
});

test("gmail input cleans email and defaults the name", () => {
  const out = cleanGmailInput({ email: " Millie@Gmail.com ", appPassword: "abcd efgh ijkl mnop" });
  assert.equal(out.email, "millie@gmail.com");
  assert.equal(out.label, "Personal");
  assert.throws(() => cleanGmailInput({ email: "nope", appPassword: "abcdefghijklmnop" }), /full email/);
  assert.throws(() => cleanGmailInput({ email: "a@b.co", label: "x".repeat(31), appPassword: "abcdefghijklmnop" }), /30/);
});

test("board ids never clash between inboxes", () => {
  assert.notEqual(boardId("acc1", "5:10"), boardId("acc2", "5:10"));
});

test("gmail web link opens the message in the right account", () => {
  assert.equal(
    gmailWebLink("me@gmail.com", "1700000000000000000"),
    `https://mail.google.com/mail/?authuser=me%40gmail.com#all/${(1700000000000000000n).toString(16)}`,
  );
  assert.equal(gmailWebLink("me@gmail.com", undefined), "https://mail.google.com/mail/?authuser=me%40gmail.com#inbox");
});

test("microsoft login asks for mail and offline access on the common endpoint", () => {
  const url = new URL(microsoftAuthUrl({ clientId: "cid", redirectUri: "https://p.example/api/microsoft/callback", state: "s" }));
  assert.equal(url.pathname, "/common/oauth2/v2.0/authorize");
  assert.match(url.searchParams.get("scope")!, /offline_access/);
  assert.match(url.searchParams.get("scope")!, /Mail\.ReadWrite/);
  assert.equal(url.searchParams.get("state"), "s");
});

test("sender parsing handles both shapes", () => {
  assert.deepEqual(parseSender('"Sam Smith" <SAM@x.com>'), { name: "Sam Smith", email: "sam@x.com" });
  assert.deepEqual(parseSender({ name: "Bob", address: "Bob@Y.com" }), { name: "Bob", email: "bob@y.com" });
  assert.deepEqual(parseSender(undefined), { name: "", email: "" });
});
