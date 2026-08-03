import {
  addDays,
  dayDetail,
  gridFill,
  leversOn,
  monthGrid,
  monthsBetween,
  WEEKDAY_INITIALS,
  windowStart,
  type Entry,
  type LeverSpan,
  type Signal,
} from "@uptime/core";
import { InteractiveGrid, type GridCell } from "./interactive-grid";
import { MonthPager } from "./month-pager";

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
 * The trailing block: `days` days, ten to a row, no calendar structure at all.
 *
 * Ten columns is a deliberate non-week. This grid answers "how has it been
 * lately", and a row that happened to be a week would invite reading down the
 * columns for a weekday pattern that the layout does not actually encode.
 * History's calendar is where that question belongs.
 *
 * **It begins at day one until the account is `days` old**, then rolls. See
 * `windowStart` — a plain rolling window reads backwards on a new account: the
 * three days someone had actually logged sat at the bottom-right behind
 * twenty-seven blanks, and every square moved one place left overnight.
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
  const start = windowStart(firstLogged(entries), today, days);

  const cells: GridCell[] = Array.from({ length: days }, (_, i) =>
    dayCell(addDays(start, i), { entries, signals, today, spans, labels }, fired),
  );

  // `dayCell` already renders anything past today as `future`, drawn as
  // nothing — the same treatment the calendar's trailing pad gets.
  const elapsed = cells.filter((c) => c.kind !== "future").length;

  return (
    <InteractiveGrid
      cells={cells}
      cols={10}
      // "Last 30 days" is a lie while the block is pinned to day one; most of
      // it has not happened yet.
      label={elapsed < days ? `Day ${elapsed} of ${days}` : `Last ${days} days`}
    />
  );
}

/**
 * History: every month since the first entry, newest first, **one per page**.
 *
 * A calendar earns its place here and not on the dashboard. Seven columns mean
 * a column IS a weekday, so "I always lose Sundays" becomes visible — and the
 * cells come out large enough to be a legitimate tap target, which the old
 * ninety-square block never was.
 *
 * It was a vertical stack, and an account a year old made this a page you
 * scrolled thirteen calendars of to reach the incident list under them. Months
 * are peers you compare, not one long document.
 */
export function MonthStack({ entries, signals, today, spans, labels }: Source) {
  // From the first entry, not from signup: a pager that opens on empty months
  // is a stack of nothing before any of the real history.
  const earliest = firstLogged(entries) ?? today;
  const anchors = monthsBetween(earliest, today);
  const fired = firedByDate(entries);

  const pages = anchors.map((anchor) => {
    /**
     * Six rows, always.
     *
     * A real month occupies four, five or six depending on how its 1st falls,
     * which was fine in a stack where each was as tall as it was. In a pager
     * the container takes the height of the page on screen, so moving between
     * a four-row February and a six-row August would resize the whole section
     * and shunt the incident list under it up and down.
     */
    const month = monthGrid(anchor, { minWeeks: 6 });
    const cells: GridCell[] = month.cells.map((date) =>
      date === null
        ? { kind: "pad" }
        : dayCell(date, { entries, signals, today, spans, labels }, fired),
    );

    const up = month.cells.filter(
      (d) => d !== null && d <= today && (fired.get(d)?.size ?? 0) > 0,
    ).length;

    return { anchor, month, cells, up };
  });

  return (
    <MonthPager
      labels={pages.map((p) => `${p.month.label} ${p.month.year} · ${p.up} up`)}
      months={pages.map(({ anchor, month, cells }) => (
        <section key={anchor} className="px-px">
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
      ))}
    />
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

/**
 * The earliest logged day, or null.
 *
 * Scanned rather than read off `entries[0]`. The query does order ascending,
 * but "the first element is the oldest" is a property no caller assembling an
 * entry list would think to preserve, and getting it wrong here moves the
 * whole grid.
 */
function firstLogged(entries: Entry[]): string | null {
  let first: string | null = null;
  for (const e of entries) {
    if (first === null || e.logged_for < first) first = e.logged_for;
  }
  return first;
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
