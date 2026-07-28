import { addDays, type Entry } from "@uptime/core";

/**
 * 30 cells, one per day. Filled = up, hollow = down, ring = today.
 *
 * Gym vs food is carried by fill weight, not hue — status colour is reserved
 * for status, and a two-colour grid would turn "which lever" into a value
 * judgement about the day.
 */
export function DayGrid({
  entries,
  today,
  days = 30,
}: {
  entries: Entry[];
  today: string;
  days?: number;
}) {
  const byDate = new Map<string, Set<string>>();
  for (const e of entries) {
    const set = byDate.get(e.logged_for) ?? new Set();
    set.add(e.lever);
    byDate.set(e.logged_for, set);
  }

  const cells = Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1 - i));
    const levers = byDate.get(date);
    return { date, levers, isToday: date === today };
  });

  return (
    <ul
      className="grid grid-cols-15 gap-[3px]"
      aria-label={`Last ${days} days`}
    >
      {cells.map(({ date, levers, isToday }) => {
        const up = !!levers?.size;
        const both = (levers?.size ?? 0) > 1;
        return (
          <li
            key={date}
            title={`${date}${up ? ` — ${[...levers!].join(" + ")}` : " — no entry"}`}
            aria-label={`${date}: ${up ? "up" : "down"}`}
            className={[
              "aspect-square rounded-[1px] transition-colors duration-200",
              up
                ? both
                  ? "bg-ink"
                  : "bg-ink-dim"
                : "bg-surface border-line border",
              isToday
                ? "ring-line-hi ring-1 ring-offset-1 ring-offset-[var(--color-bg)]"
                : "",
            ].join(" ")}
          />
        );
      })}
    </ul>
  );
}
