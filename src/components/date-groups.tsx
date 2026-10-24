"use client";

import { Fragment, type ReactNode } from "react";
import { groupBySchedule, type ScheduleItem } from "@/lib/schedule-groups";

export function DateGroups<T extends ScheduleItem & { id: string }>({
  items,
  now = new Date(),
  empty,
  className,
  itemsClassName,
  render,
}: {
  items: T[];
  now?: Date;
  empty?: ReactNode;
  className?: string;
  itemsClassName?: string;
  render: (item: T) => ReactNode;
}) {
  if (items.length === 0) return empty ?? null;
  const groups = groupBySchedule(items, now);
  return (
    <div className={className ? `date-groups ${className}` : "date-groups"}>
      {groups.map((group) => {
        const body = (
          <div className={itemsClassName ?? "date-group-items"}>
            {group.items.map((item) => (
              <Fragment key={item.id}>{render(item)}</Fragment>
            ))}
          </div>
        );
        if (group.past) {
          return (
            <details key={group.id} className="date-group past">
              <summary className="date-heading">
                Past
                <span className="date-count">{group.items.length}</span>
              </summary>
              {body}
            </details>
          );
        }
        return (
          <section key={group.id} className="date-group" aria-label={group.heading}>
            <h3 className="date-heading">{group.heading}</h3>
            {body}
          </section>
        );
      })}
    </div>
  );
}
