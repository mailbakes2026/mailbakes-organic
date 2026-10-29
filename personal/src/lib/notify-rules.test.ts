import assert from "node:assert/strict";
import test from "node:test";
import { cleanNotice, parseMuted, pushPayload, shouldPush } from "./notify-rules.ts";

test("notices from other apps are checked and keyed by source", () => {
  const n = cleanNotice({ source: "Team", title: " Sam called in sick ", body: "Back Mon", key: "sick:12", url: "https://operations.mailbakes.com/x" });
  assert.equal(n.source, "team");
  assert.equal(n.key, "team:sick:12");
  assert.equal(n.title, "Sam called in sick");
  assert.throws(() => cleanNotice({ source: "nope", title: "x" }), /source must be/);
  assert.throws(() => cleanNotice({ source: "team" }), /title/);
  assert.throws(() => cleanNotice({ source: "team", title: "x", url: "javascript:alert(1)" }), /web address/);
  assert.throws(() => cleanNotice({ source: "team", title: "x", key: "bad key!" }), /key/);
});

test("without a key every notice is new", () => {
  const a = cleanNotice({ source: "other", title: "x" });
  const b = cleanNotice({ source: "other", title: "x" });
  assert.notEqual(a.key, b.key);
});

test("muted list ignores junk", () => {
  assert.deepEqual(parseMuted('["team","bogus"]'), ["team"]);
  assert.deepEqual(parseMuted("not json"), []);
  assert.deepEqual(parseMuted(null), []);
});

test("a key only buzzes once, and muted sources never do", () => {
  assert.equal(shouldPush({ source: "team", alreadyPushed: false, muted: [] }), true);
  assert.equal(shouldPush({ source: "team", alreadyPushed: true, muted: [] }), false);
  assert.equal(shouldPush({ source: "team", alreadyPushed: false, muted: ["team"] }), false);
});

test("push text is kept short and always has somewhere to open", () => {
  const p = JSON.parse(pushPayload({ title: "T", body: "x".repeat(300), url: "", key: "k" }, "https://app/notifications"));
  assert.equal(p.body.length, 178);
  assert.equal(p.url, "https://app/notifications");
  assert.equal(p.tag, "k");
});
