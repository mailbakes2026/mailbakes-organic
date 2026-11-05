export function revenueLabel(rows: { revenuePence: number | null; currency: string }[]) {
  const withMoney = rows.filter((row) => row.revenuePence !== null);
  if (!withMoney.length) return null;
  const currencies = [...new Set(withMoney.map((row) => (/^[A-Z]{3}$/.test(row.currency) ? row.currency : "GBP")))];
  if (currencies.length !== 1) return "Mixed currencies";
  const total = withMoney.reduce((sum, row) => sum + (row.revenuePence ?? 0), 0);
  return formatMoney(total, currencies[0] ?? "GBP");
}

export function formatMoney(pence: number, currency: string) {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "GBP";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pence / 100);
}

export function formatRoas(revenuePence: number, spendPence: number) {
  if (spendPence === 0) return null;
  const value = revenuePence / spendPence;
  if (!Number.isFinite(value)) return null;
  return `${value.toFixed(2)}×`;
}

export function formatCpa(spendPence: number, orders: number, currency: string) {
  if (orders <= 0) return null;
  return formatMoney(Math.round(spendPence / orders), currency);
}

export function formatChange(ratio: number | null) {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  const pct = ratio * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatRate(ratio: number | null) {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatCount(value: number | null) {
  if (value === null) return null;
  return new Intl.NumberFormat("en-GB").format(value);
}
