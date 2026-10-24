export const SIGN_IN_ERROR = "That name or password isn't right.";

type NamedAccount = { id: string; email: string; name: string };

const MILLIE_ALIASES = new Set(["millie", "millie@mailbakes.com"]);

export function isMillieAlias(identifier: string) {
  return MILLIE_ALIASES.has(identifier.trim().toLowerCase());
}

function isMillieAccount(account: NamedAccount) {
  const name = account.name.trim().toLowerCase();
  const email = account.email.trim().toLowerCase();
  return name === "millie" || email === "millie@mailbakes.com";
}

export function signInIdentifier(name: unknown, email: unknown) {
  const fromName = typeof name === "string" ? name.trim() : "";
  if (fromName) return fromName;
  return typeof email === "string" ? email.trim() : "";
}

// Email hits come first so an existing email still opens that account.
// A shared name is then settled by whichever password matches.
export function signInCandidates<T extends NamedAccount>(identifier: string, accounts: T[]) {
  const name = identifier.trim();
  if (!name) return [];
  const email = name.toLowerCase();
  const byEmail = accounts
    .filter((account) => account.email.trim().toLowerCase() === email)
    .sort((a, b) => a.id.localeCompare(b.id));
  const emailIds = new Set(byEmail.map((account) => account.id));
  const byName = accounts
    .filter((account) => !emailIds.has(account.id) && account.name.trim().toLowerCase() === name.toLowerCase())
    .sort((a, b) => a.id.localeCompare(b.id));
  const direct = [...byEmail, ...byName];
  if (!isMillieAlias(name)) return direct;
  const seen = new Set(direct.map((account) => account.id));
  const aliases = accounts
    .filter((account) => !seen.has(account.id) && isMillieAccount(account))
    .sort((a, b) => a.id.localeCompare(b.id));
  return [...direct, ...aliases];
}

export async function accountForPassword<T extends { passwordHash: string }>(
  password: string,
  candidates: T[],
  compare: (password: string, hash: string) => Promise<boolean>,
) {
  if (!password) return null;
  for (const account of candidates) {
    if (await compare(password, account.passwordHash)) return account;
  }
  return null;
}
