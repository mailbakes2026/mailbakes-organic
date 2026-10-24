import type { Role } from "@/lib/types";

export type AccountSpec = {
  email: string;
  password: string;
  name: string;
  role: Role;
};

type Env = Record<string, string | undefined>;

// Millie approves. The Manager (content team) creates posts and makes amendments.
// Millie's password is read from MILLIE_PASSWORD. MANAGEMENT_PASSWORD is only a
// fallback so an existing deploy keeps working until MILLIE_PASSWORD is set.
// Bracket access, read when this is called, so a production build cannot bake in
// an empty MILLIE_PASSWORD from the build machine. Render sets it on the running service.
export function milliePasswordFromEnv(env: Env): string | null {
  const millie = env["MILLIE_PASSWORD"];
  const fallback = env["MANAGEMENT_PASSWORD"];
  if (typeof millie === "string" && millie.length > 0) return millie;
  if (typeof fallback === "string" && fallback.length > 0) return fallback;
  return null;
}

// Constant-time compare with no node:crypto import. accounts.ts is pulled into
// the server bundle via bootstrap, and webpack cannot load the node: scheme.
export function samePassword(typed: string, expected: string) {
  if (typed.length === 0 || typed.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < typed.length; i++) diff |= typed.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function accountsFromEnv(env: Env): AccountSpec[] {
  const accounts: AccountSpec[] = [];
  const milliePassword = milliePasswordFromEnv(env);
  if (milliePassword) {
    accounts.push({
      email: (env.MANAGEMENT_EMAIL || "millie@mailbakes.com").trim().toLowerCase(),
      password: milliePassword,
      name: env.MANAGEMENT_NAME?.trim() || "Millie",
      role: "MANAGEMENT",
    });
  }
  if (env.TEAM_PASSWORD) {
    accounts.push({
      email: (env.TEAM_EMAIL || "team@mailbakes.com").trim().toLowerCase(),
      password: env.TEAM_PASSWORD,
      name: env.TEAM_NAME?.trim() || "Manager",
      role: "TEAM",
    });
  }
  if (env.EXTRA_USERS) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(env.EXTRA_USERS);
    } catch {
      throw new Error("EXTRA_USERS must be JSON.");
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const email = String(record.email ?? "").trim().toLowerCase();
        const password = String(record.password ?? "");
        const role = record.role === "MANAGEMENT" || record.role === "TEAM" ? record.role : null;
        if (!email || !password || !role) continue;
        accounts.push({
          email,
          password,
          name: String(record.name || email),
          role,
        });
      }
    }
  }
  for (const account of accounts) {
    if (account.password.length < 10) {
      throw new Error(`The password for ${account.email} must be at least 10 characters.`);
    }
  }
  return accounts;
}
