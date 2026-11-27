export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-head-copy">
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
      </div>
      {actions ? <div className="head-actions">{actions}</div> : null}
    </div>
  );
}

export function MetricLine({ parts }: { parts: Array<{ value: string; label: string; tone?: "good" | "alert" }> }) {
  const shown = parts.filter((part) => part.value !== "");
  if (!shown.length) return null;
  return (
    <p className="metric-line">
      {shown.map((part, index) => (
        <span key={`${part.label}:${part.value}`}>
          {index > 0 ? <span className="metric-sep"> · </span> : null}
          <b className={part.tone ? `is-${part.tone}` : undefined}>{part.value}</b> {part.label}
        </span>
      ))}
    </p>
  );
}

export function Callout({ lead, children }: { lead: string; children?: React.ReactNode }) {
  return (
    <p className="callout">
      <b>{lead}</b>
      {children ? <> {children}</> : null}
    </p>
  );
}

export function SyncFailure({ sync }: { sync: { status: string; detail: string } | null }) {
  if (sync?.status !== "error" || !sync.detail) return null;
  return <Callout lead="Last Klaviyo sync failed.">{sync.detail}</Callout>;
}
