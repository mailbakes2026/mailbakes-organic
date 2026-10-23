import assert from "node:assert/strict";
import test from "node:test";
import { accountForPassword, signInCandidates, signInIdentifier } from "./sign-in.ts";

const accounts = [
  {
    id: "m",
    email: "millie@mailbakes.com",
    name: "Millie",
    role: "MANAGEMENT" as const,
    passwordHash: "management-secret",
  },
  {
    id: "t",
    email: "team@mailbakes.com",
    name: "Content team",
    role: "TEAM" as const,
    passwordHash: "team-secret",
  },
];

const compare = async (password: string, hash: string) => password === hash;

test("a typed email still finds that account", () => {
  const hits = signInCandidates("  Millie@MailBakes.com ", accounts);
  assert.deepEqual(hits.map((account) => account.role), ["MANAGEMENT"]);
});

test("a typed name finds that account", () => {
  const hits = signInCandidates("content team", accounts);
  assert.deepEqual(hits.map((account) => account.role), ["TEAM"]);
});

test("the role follows the password when one name matches two accounts", async () => {
  const shared = [
    { id: "b", email: "b@mailbakes.com", name: "sam", role: "TEAM" as const, passwordHash: "team-secret" },
    { id: "a", email: "a@mailbakes.com", name: "Sam", role: "MANAGEMENT" as const, passwordHash: "management-secret" },
  ];
  const hits = signInCandidates(" Sam ", shared);
  assert.deepEqual(
    hits.map((account) => account.id),
    ["a", "b"],
  );
  const management = await accountForPassword("management-secret", hits, compare);
  const team = await accountForPassword("team-secret", hits, compare);
  assert.equal(management?.role, "MANAGEMENT");
  assert.equal(team?.role, "TEAM");
  assert.equal(await accountForPassword("nope", hits, compare), null);
});

test("an email match is preferred, and the other password does not cross over", async () => {
  const mixed = [
    { id: "named", email: "other@mailbakes.com", name: "millie@mailbakes.com", role: "TEAM" as const, passwordHash: "team-secret" },
    { id: "inbox", email: "millie@mailbakes.com", name: "Millie", role: "MANAGEMENT" as const, passwordHash: "management-secret" },
  ];
  const hits = signInCandidates("millie@mailbakes.com", mixed);
  assert.equal((await accountForPassword("management-secret", hits, compare))?.id, "inbox");
  assert.equal((await accountForPassword("team-secret", hits, compare))?.role, "TEAM");
});

test("a blank name matches nobody", async () => {
  assert.deepEqual(signInCandidates("   ", accounts), []);
  assert.equal(await accountForPassword("", accounts, compare), null);
  assert.equal(signInIdentifier("  ", " team@mailbakes.com "), "team@mailbakes.com");
  assert.equal(signInIdentifier(" Millie ", "team@mailbakes.com"), "Millie");
});
