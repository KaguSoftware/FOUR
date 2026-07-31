import {
  addDays,
  dayDetail,
  gridFill,
  leversOn,
  monthGrid,
  monthsBetween,
  WEEKDAY_INITIALS,
  type Entry,
  type LeverSpan,
  type Signal,
} from "@uptime/core";
import { InteractiveGrid, type GridCell } from "./interactive-grid";

/**
 * The day grid, in the two shapes the product uses.
 *
 * Fill lightness carries HOW MANY levers fired, never WHICH — status colour is
 * reserved for status, and a colour-coded grid would turn "which lever" into a
 * value judgement about the day. It is proportional: two of three levers is two
 * thirds of the way to ink.
 *
 * The cell is never subdivided. Segments, quadrants and fractional fills draw
 * the absence as a visible hole, and a hole reads as "you did not finish" —
 * which is the one thing this grid must never say. A dim cell is still a whole
 * cell; that is the distinction that makes a ramp acceptable where a segmented
 * meter is not.
 *
 * These are server components: they hold the whole history and hand the client
 * only the days actually on screen, already shaded. The tap behaviour lives in
 * `InteractiveGrid`.
 */

type Source = {
  entries: Entry[];
  signals: Signal[];
  today: string;
  /**
   * Every lever's lifespan, archived included. Each day is shaded against the
   * levers that existed THAT day — using today's count re-scales history every
   * time a lever is added.
   */
  spans: LeverSpan[];
  /** Lever key to label, archived included, so an old day keeps its names. */
  labels: Map<string, string>;
};

/**
 * The trailing block: the last `days` days, ten to a row, no calendar
 * structure at all.
 *
 * Ten columns is a deliberate non-week. This grid answers "how has it been
 * lately", and a row that happened to be a week would invite reading down the
 * columns for a weekday pattern that the layout does not actually encode.
 * History's calendar is where that question belongs.
 */
export function DayGrid({
  entries,
  signals,
  today,
  spans,
  labels,
  days = 30,
}: Source & { days?: number }) {
  const fired = firedByDate(entries);
  const cells: GridCell[] = Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1 - i));
    return dayCell(date, { entries, signals, today, spans, labels }, fired);
  });

  return (
    <InteractiveGrid cells={cells} cols={10} label={`Last ${days} days`} />
  );
}

/**
 * History: every month since the first entry, newest first.
 *
 * A calendar earns its place here and not on the dashboard. Seven columns mean
 * a column IS a weekday, so "I always lose Sundays" becomes visible — and the
 * cells come out large enough to be a legitimate tap target, which the old
 * ninety-square block never was.
 */
export function MonthStack({ entries, signals, today, spans, labels }: Source) {
  // From the first entry, not from signup: a stack that opens with empty
  // months is a wall of nothing before any of the real history.
  const earliest = entries[0]?.logged_for ?? today;
  const anchors = monthsBetween(earliest, today);
  const fired = firedByDate(entries);

  return (
    <div className="flex flex-col gap-8">
      {anchors.map((anchor) => {
        const month = monthGrid(anchor);
        const cells: GridCell[] = month.cells.map((date) =>
          date === null
            ? { kind: "pad" }
            : dayCell(date, { entries, signals, today, spans, labels }, fired),
        );

        const up = month.cells.filter(
          (d) => d !== null && d <= today && (fired.get(d)?.size ?? 0) > 0,
        ).length;

        return (
          <section key={anchor}>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="label">
                {month.label} {month.year}
              </p>
              <p className="tabular text-ink-mute text-xs">{up} up</p>
            </div>

            <ul
              className="text-ink-mute mb-2 grid grid-cols-7 gap-[3px] text-center text-[11px]"
              aria-hidden="true"
            >
              {WEEKDAY_INITIALS.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>

            <InteractiveGrid
              cells={cells}
              cols={7}
              label={`${month.label} ${month.year}`}
            />
          </section>
        );
      })}
    </div>
  );
}

/**
 * Distinct levers per day, indexed once.
 *
 * Built up front rather than scanned per cell: the month stack renders every
 * month since the first entry, so a per-cell scan is the whole entry list
 * walked once per day of history.
 */
function firedByDate(entries: Entry[]) {
  const byDate = new Map<string, Set<string>>();
  for (const e of entries) {
    const set = byDate.get(e.logged_for) ?? new Set<string>();
    set.add(e.lever);
    byDate.set(e.logged_for, set);
  }
  return byDate;
}

/** One real day, shaded and loaded with its detail. */
function dayCell(
  date: string,
  src: Source,
  fired: Map<string, Set<string>>,
): GridCell {
  if (date > src.today) return { kind: "future", date };

  return {
    kind: "day",
    date,
    // The ramp is generated, so the fill is a value rather than a class.
    fill: gridFill(fired.get(date)?.size ?? 0, leversOn(src.spans, date)),
    isToday: date === src.today,
    detail: dayDetail(date, src.entries, src.signals, src.labels, src.today),
  };
}
