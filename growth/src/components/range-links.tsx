export function RangeLinks({ base, range }: { base: string; range: "7d" | "28d" }) {
  return (
    <div className="row">
      <a className={`btn sm ${range === "7d" ? "" : "ghost"}`} href={`${base}?range=7d`}>
        7 days
      </a>
      <a className={`btn sm ${range === "28d" ? "" : "ghost"}`} href={`${base}?range=28d`}>
        28 days
      </a>
    </div>
  );
}
