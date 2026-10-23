export const SIGN_IN_ERROR = "That name or password isn't right.";

// A display name only. The password is what allows the sign-in.
const DISPLAY_NAME_LIMIT = 80;

export function signInDisplayName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim().slice(0, DISPLAY_NAME_LIMIT);
  return name || null;
}

export function sessionDisplayName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const name = value.trim();
  return name || fallback;
}
