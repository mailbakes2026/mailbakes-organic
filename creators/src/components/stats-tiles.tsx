import { STAGES } from "@/lib/stages";
import { awaitingMessage, rushItems, shippedThisWeek, stageCounts } from "@/lib/stats";
import type { CreatorDTO } from "@/lib/types";

export function StatsTiles({ creators }: { creators: CreatorDTO[] }) {
  const counts = stageCounts(creators);
  const rush = rushItems(creators);
  return (
    <section className="stats" aria-label="Pipeline summary">
      <article className="stat stat-wide">
        <span className="eyebrow">Creators by stage</span>
        <ul className="stage-counts">
          {STAGES.map((stage) => (
            <li key={stage.slug} className={counts[stage.slug] === 0 ? "is-zero" : ""}>
              <b>{counts[stage.slug]}</b>
              <span>{stage.label}</span>
            </li>
          ))}
        </ul>
      </article>
      <article className="stat">
        <span className="eyebrow">Shipped this week</span>
        <b className="stat-num">{shippedThisWeek(creators)}</b>
        <span className="muted small">Monday to Sunday, London</span>
      </article>
      <article className="stat">
        <span className="eyebrow">Awaiting message</span>
        <b className="stat-num">{awaitingMessage(creators)}</b>
        <span className="muted small">Message needed</span>
      </article>
      <article className={`stat${rush > 0 ? " attention" : ""}`}>
        <span className="eyebrow">Rush</span>
        <b className="stat-num">{rush}</b>
        <span className="muted small">Still to deal with</span>
      </article>
    </section>
  );
}
