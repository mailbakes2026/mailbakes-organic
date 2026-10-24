import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { accountsFromEnv } from "./accounts.ts";

test("Millie uses MILLIE_PASSWORD and the Manager keeps the team password", () => {
  const accounts = accountsFromEnv({
    MILLIE_PASSWORD: "millie-secret-value",
    MANAGEMENT_PASSWORD: "old-management-secret",
    MANAGEMENT_EMAIL: "millie@mailbakes.com",
    TEAM_PASSWORD: "team-secret-value",
    TEAM_EMAIL: "team@mailbakes.com",
    TEAM_NAME: "Manager",
  });
  const millie = accounts.find((account) => account.role === "MANAGEMENT");
  const manager = accounts.find((account) => account.role === "TEAM");
  assert.equal(millie?.name, "Millie");
  assert.equal(millie?.email, "millie@mailbakes.com");
  assert.equal(millie?.password, "millie-secret-value");
  assert.equal(manager?.name, "Manager");
  assert.equal(manager?.email, "team@mailbakes.com");
  assert.equal(manager?.password, "team-secret-value");
});

test("MILLIE_PASSWORD is preferred, and the team password still signs the Manager in", () => {
  const fallback = accountsFromEnv({
    MANAGEMENT_PASSWORD: "old-management-secret",
    TEAM_PASSWORD: "team-secret-value",
  });
  assert.equal(fallback.find((account) => account.role === "MANAGEMENT")?.password, "old-management-secret");
  assert.equal(fallback.find((account) => account.role === "TEAM")?.name, "Manager");
  assert.equal(accountsFromEnv({ TEAM_PASSWORD: "team-secret-value" }).some((account) => account.role === "MANAGEMENT"), false);
});

test("Millie's password is not hardcoded", () => {
  const source = readFileSync(new URL("./accounts.ts", import.meta.url), "utf8");
  assert.match(source, /MILLIE_PASSWORD/);
  assert.doesNotMatch(source, /MILLIE_PASSWORD\s*=\s*["'`]/);
  assert.equal(accountsFromEnv({}).length, 0);
});
