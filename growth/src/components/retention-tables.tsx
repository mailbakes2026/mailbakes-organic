import { formatCount, formatMoney, formatRate } from "@/lib/format";
import type { SendFact } from "@/lib/retention/metrics";

export function SendTable({ title, hint, rows }: { title: string; hint: string; rows: SendFact[] }) {
  return (
    <article className="card">
      <div className="subhead">
        <h2>{title}</h2>
      </div>
      <p className="muted small">{hint}</p>
      {rows.length === 0 ? (
        <p className="empty-state">Nothing is stored for this window. Sync Klaviyo, or push rows to POST /api/v1/ingest.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Revenue</th>
                <th className="num">Open</th>
                <th className="num">Click</th>
                <th className="num">Unsubscribes</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.source}:${row.id}`}>
                  <td className="name">{row.name}</td>
                  <td className="num">{row.revenuePence === null ? "—" : formatMoney(row.revenuePence, row.currency || "GBP")}</td>
                  <td className="num">
                    {formatRate(row.openRate) ?? "—"}
                    {row.opens !== null ? <div className="muted small">{formatCount(row.opens)} opens</div> : null}
                  </td>
                  <td className="num">
                    {formatRate(row.clickRate) ?? "—"}
                    {row.clicks !== null ? <div className="muted small">{formatCount(row.clicks)} clicks</div> : null}
                  </td>
                  <td className="num">{row.unsubscribes === null ? "—" : formatCount(row.unsubscribes)}</td>
                  <td>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
