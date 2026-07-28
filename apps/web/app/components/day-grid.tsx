import { addDays, gridFill, type Entry } from "@uptime/core";

/**
 * 30 cells, one per day. Filled = up, hollow = down, ring = today.
 *
 * Fill lightness carries HOW MANY levers fired, never WHICH — status colour is
 * reserved for status, and a colour-coded grid would turn "which lever" into a
 * value judgement about the day.
 *
 * The cell is never subdivided. Segments, quadrants and fractional fills draw
 * the absence as a visible hole, and a hole reads as "you did not finish" —
 * which is the one thing this grid must never say. A dim cell is still a whole
 * cell; that is the distinction that makes a ramp acceptable where a segmented
 * meter is not.
 */
export function DayGrid({
  entries,
  today,
  leverCount,
  days = 30,
}: {
  entries: Entry[];
  today: string;
  /** Active levers, which sets the number of ramp steps. */
  leverCount: number;
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
        const fired = levers?.size ?? 0;
        // The ramp is generated, so the fill is a value rather than a class.
        const fill = gridFill(fired, leverCount);
        return (
          <li
            key={date}
            title={`${date}${fill ? ` — ${[...levers!].join(" + ")}` : " — no entry"}`}
            aria-label={`${date}: ${fill ? "up" : "down"}`}
            style={fill ? { backgroundColor: fill } : undefined}
            className={[
              "aspect-square rounded-[1px] transition-colors duration-200",
              // A down cell is a surface plus a border, never just a darker
              // fill — the border is what keeps state off colour alone.
              fill ? "" : "bg-surface border-line border",
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
