export function DataSkeleton() {
  return (
    <div className="skel" aria-busy="true" aria-label="Loading">
      <span className="skel-bar skel-metric" />
      <div className="skel-grid">
        <span className="skel-card" />
        <span className="skel-card" />
        <span className="skel-card" />
        <span className="skel-card" />
      </div>
      <span className="skel-card skel-wide" />
    </div>
  );
}
