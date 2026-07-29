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
 */
export function monthGrid(iso: string): MonthGrid {
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

  return {
    label: MONTHS[month1 - 1],
    daysInMonth: total,
    dayOfMonth,
    cells,
  };
}

/** Column headers for a Monday-first grid. */
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;
