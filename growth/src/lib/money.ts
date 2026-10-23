export function toPence(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const text = String(value);
    if (text.includes("e") || text.includes("E")) return null;
    return toPence(text);
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(text);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2]);
  if (!Number.isSafeInteger(whole)) return null;
  const fraction = match[3] ?? "";
  const cents = Number(fraction.padEnd(2, "0").slice(0, 2) || "0");
  const roundUp = fraction.length > 2 && Number(fraction[2]) >= 5;
  let pence = whole * 100 + cents + (roundUp ? 1 : 0);
  pence *= sign;
  if (!Number.isSafeInteger(pence) || Math.abs(pence) > 1_000_000_000_000) return null;
  return pence;
}

export function toCount(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > 1_000_000_000) return null;
    return value;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  return toCount(Number(value.trim()));
}

export function optionalCount(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  const count = toCount(value);
  if (count === null) return undefined;
  return count;
}
