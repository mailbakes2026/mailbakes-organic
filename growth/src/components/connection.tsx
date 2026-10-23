export function ConnectionCard({
  title,
  label,
  state,
  detail,
}: {
  title: string;
  label: string;
  state: "connected" | "not-connected" | "error";
  detail: string;
}) {
  const pill = state === "connected" ? "ok" : state === "error" ? "warn" : "";
  return (
    <article className="connection">
      <header>
        <h2>{title}</h2>
        <span className={`pill ${pill}`.trim()}>{label}</span>
      </header>
      <p>{detail}</p>
    </article>
  );
}
