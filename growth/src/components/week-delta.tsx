import { formatChange, formatMoney } from "@/lib/format";
import { relativeChange } from "@/lib/retention/weeks";

export function WeekDelta({ current, previous, currency }: { current: number | null; previous: number | null; currency: string }) {
  if (current === null) return <span className="wow is-unknown">Not stored</span>;
  const change = relativeChange(current, previous);
  if (previous === null || change.direction === "unknown") return <span className="wow is-unknown">No prior week</span>;
  if (change.direction === "flat") return <span className="wow is-flat">No change</span>;
  const money = formatMoney(Math.abs(current - previous), currency || "GBP");
  const pct = formatChange(change.ratio);
  if (!pct) return <span className="wow is-unknown">No prior week</span>;
  const up = change.direction === "up";
  return <span className={`wow ${up ? "is-up" : "is-drop"}`}>{up ? "Up" : "Down"} {money} · {pct}</span>;
}
