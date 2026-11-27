export function RateBar({ label, value, width, note, marker }: { label: string; value: string; width: number; note?: string; marker?: number | null }) {
  const clamped = Math.max(0, Math.min(100, width));
  const mark = marker === null || marker === undefined ? null : Math.max(0, Math.min(100, marker));
  return (
    <div className="rate">
      <div className="rate-top">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <span className="track" aria-hidden="true">
        <i style={{ width: `${clamped}%` }} />
        {mark === null ? null : <em className="rate-mark" style={{ left: `${mark}%` }} />}
      </span>
      {note ? <span className="muted small">{note}</span> : null}
    </div>
  );
}
