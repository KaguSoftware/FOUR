/**
 * The calendar month, as a grid.
 *
 * The dashboard used to render the trailing 30 days, which meant today was
 * always the last cell and the grid never lined up with the month anyone was
 * actually living in — on the 29th of a 31-day month it showed you the last day
 * of a 30-day one. This turns the grid into a calendar.
 *
 * **This does not touch the hero.** `uptimeWindow` stays a 30-day ROLLING
 * window, because a calendar-month figure reads `0/31` on the first of every
 * month and the product's whole claim is that no screen can send you back to
 * zero. The grid answers "where am I in this month"; the number answers "is the
 * system up", and those are different questions.
 *
 * Dates are YYYY-MM-DD strings handled in UTC throughout, matching `uptime.ts`.
 * Nothing here goes near `Intl` — see `logicalDateLocal` for why that is not
 * safe on this runtime.
 */

import { upDates, type Entry } from "./uptime";

/** Monday-first, matching how a week is written in the product's locale. */
const WEEK = 7;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type MonthGrid = {
  /** "July" — the month the given date falls in. */
  label: string;
  /** Four-digit calendar year. A stack of months spanning a new year needs it. */
  year: number;
  /** 1-12. */
  month: number;
  /** 28-31. */
  daysInMonth: number;
  /** 1-31: which day of the month the input was. */
  dayOfMonth: number;
  /**
   * Row-major, seven per row, always a whole number of rows.
   *
   * `null` is padding — a cell belonging to the month before or after. It is
   * NOT a down day and clients must not draw it as one; a day outside the month
   * has no state at all.
   */
  cells: (string | null)[];
};

/** Days in the month containing `iso`. */
function daysInMonth(year: number, month1: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Monday-first weekday index, 0-6.
 *
 * `getUTCDay()` is Sunday-first, so Sunday (0) has to become 6 rather than
 * leading the row. Getting this wrong shifts the entire grid by a day and is
 * invisible in any month that happens to start on a Monday.
 */
function mondayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % WEEK;
}

/**
 * The calendar month containing `iso`, padded to whole weeks.
 *
 * Throws on a malformed date rather than returning a plausible-looking grid for
 * the wrong month — every caller has a real date from `logicalDateLocal`, so a
 * bad one here means something upstream is broken and should say so.
 *
 * **`minWeeks` pads every month to the same number of rows.** A real calendar
 * month occupies four, five or six rows depending on how its 1st falls, which
 * is fine in a vertical stack where each month is simply as tall as it is —
 * and wrong in a horizontal pager, where the container takes the height of the
 * page on screen and every swipe between a five-row and a six-row month makes
 * the whole layout jump. Six is the maximum any month can need, so
 * `minWeeks: 6` makes every page identical in height. The extra rows are the
 * same `null` padding as the leading and trailing days, and clients already
 * draw padding as nothing.
 */
export function monthGrid(iso: string, opts: { minWeeks?: number } = {}): MonthGrid {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`monthGrid: expected YYYY-MM-DD, got "${iso}"`);

  const year = Number(match[1]);
  const month1 = Number(match[2]);
  const dayOfMonth = Number(match[3]);

  const total = daysInMonth(year, month1);
  const lead = mondayIndex(new Date(Date.UTC(year, month1 - 1, 1)));

  const cells: (string | null)[] = new Array(lead).fill(null);
  const mm = String(month1).padStart(2, "0");
  for (let day = 1; day <= total; day++) {
    cells.push(`${year}-${mm}-${String(day).padStart(2, "0")}`);
  }
  // Pad out the final week so the grid is rectangular and the last row does not
  // reflow its cells across the width.
  while (cells.length % WEEK !== 0) cells.push(null);

  // Then, optionally, out to a fixed number of rows. Clamped at 6 because no
  // calendar month can span more, and a caller asking for more would only be
  // adding empty rows to every page.
  const minWeeks = Math.min(Math.max(Math.trunc(opts.minWeeks ?? 0), 0), 6);
  while (cells.length < minWeeks * WEEK) cells.push(null);

  return {
    label: MONTHS[month1 - 1],
    year,
    month: month1,
    daysInMonth: total,
    dayOfMonth,
    cells,
  };
}

/** Column headers for a Monday-first grid. */
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/**
 * `iso` shifted by `n` calendar months, clamped to the target month's length.
 *
 * Clamping is the whole point. `Date.UTC(2026, 2 - 1, 31)` silently rolls into
 * March, so a naive implementation walking back from the 31st skips February
 * entirely — the month stack would then be missing a month, and nothing about
 * the output would look wrong. Landing on the 28th instead is correct here
 * because callers use the result as an ANCHOR into a month, never as a date in
 * its own right.
 */
export function addMonths(iso: string, n: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`addMonths: expected YYYY-MM-DD, got "${iso}"`);

  const year = Number(match[1]);
  const month1 = Number(match[2]);
  const day = Number(match[3]);

  // Months as a single count, so the year rolls over without a branch and
  // negative `n` works the same as positive.
  const total = year * 12 + (month1 - 1) + n;
  const targetYear = Math.floor(total / 12);
  const targetMonth1 = (total % 12) + 1;

  const clamped = Math.min(day, daysInMonth(targetYear, targetMonth1));

  return [
    String(targetYear).padStart(4, "0"),
    String(targetMonth1).padStart(2, "0"),
    String(clamped).padStart(2, "0"),
  ].join("-");
}

/**
 * One anchor date per calendar month from `fromIso` to `toIso`, newest first.
 *
 * Anchors are the FIRST of each month, not the input dates — the caller feeds
 * these straight to `monthGrid`, which only cares which month it lands in, and
 * a first-of-month anchor cannot be clamped into the wrong one.
 *
 * Returns `[]` when the range is inverted rather than looping forever or
 * guessing which end was meant.
 */
export function monthsBetween(fromIso: string, toIso: string): string[] {
  const first = firstOfMonth(fromIso);
  const last = firstOfMonth(toIso);
  if (first > last) return [];

  const out: string[] = [];
  for (let cursor = last; cursor >= first; cursor = addMonths(cursor, -1)) {
    out.push(cursor);
    // `addMonths` on the earliest month would step below the range; stopping
    // here also keeps year 0 from underflowing the loop condition.
    if (cursor === first) break;
  }
  return out;
}

/** The 1st of the month containing `iso`. Validates via `addMonths`. */
function firstOfMonth(iso: string): string {
  return `${addMonths(iso, 0).slice(0, 7)}-01`;
}

export type MonthUptime = {
  /** Days in this month with at least one entry. */
  up: number;
  /** The denominator — see `basis`. */
  total: number;
  /** `up / total`, 0..1. Zero rather than NaN when `total` is 0. */
  pct: number;
};

/**
 * Days up in the calendar month containing `today`.
 *
 * This drives the pixel wall, which is the one screen in the product that
 * measures a MONTH rather than a rolling window. Everywhere else — the hero,
 * the day grid — deliberately does not, for the reason in this file's own
 * docblock at the top.
 *
 * **`basis` is a product decision wearing a parameter's clothes.**
 *
 * - `"month"` divides by the whole month, so a perfect record still reads
 *   `2/31` on the 2nd. The wall is near-dark for the first week of every month
 *   and its message unreadable, then fills. That is a monthly reset, and it is
 *   the shape the owner asked for on 2026-08-03.
 * - `"elapsed"` divides by the days so far, so a clean month is a full wall
 *   from day one and each missed day chips it. No reset.
 *
 * Both are one call-site away, on purpose: this is the kind of decision that is
 * only really made by living with it for a month.
 *
 * Future days in the current month are never counted as up — they have not
 * happened, and `"month"` already puts them in the denominator, which is
 * exactly what makes the two bases differ.
 */
export function monthUptime(
  entries: readonly Entry[],
  today: string,
  basis: "month" | "elapsed" = "month",
): MonthUptime {
  const grid = monthGrid(today);
  const up = upDates(entries as Entry[]);

  let count = 0;
  for (const date of grid.cells) {
    if (date === null || date > today) continue;
    if (up.has(date)) count++;
  }

  const total = basis === "elapsed" ? grid.dayOfMonth : grid.daysInMonth;
  return { up: count, total, pct: total > 0 ? count / total : 0 };
}
