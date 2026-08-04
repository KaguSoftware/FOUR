/**
 * Uptime derivation.
 *
 * Everything in this module is computed from a set of dates. Nothing is
 * stored, nothing is incremented, nothing can be reset. That is the whole
 * point: there is no counter to zero out, so the system is structurally
 * incapable of telling you to start over.
 */

export const UPTIME_WINDOW = 30;

/**
 * When the day rolls over, if the account has not chosen otherwise.
 *
 * 04:00 rather than midnight, so a 01:30 session belongs to the day that just
 * ended rather than the one that technically started. It is a SETTING as of
 * 2026-08-04 (`system_state.day_boundary_hour`); this is the default every
 * account starts on and the fallback wherever the real value is not to hand.
 */
export const DAY_BOUNDARY_HOUR = 4;

/**
 * 0 is midnight, the answer most people would give if asked. Past noon the
 * word "day" stops matching what is being measured, so 12 is the far end.
 * Mirrors the CHECK constraint on the column.
 */
export const DAY_BOUNDARY_MIN = 0;
export const DAY_BOUNDARY_MAX = 12;

/**
 * A trustworthy boundary hour, whatever arrived.
 *
 * The date functions below are the most load-bearing code in this package —
 * every screen, the run length, the down count and the pager key off them —
 * and a `NaN` reaching one of them produces `Invalid Date`, which formats as a
 * date-shaped string nobody would question. So a bad value falls back to the
 * default rather than propagating: a wrong-by-hours date is recoverable, a
 * silently corrupt one is not.
 */
export function clampBoundaryHour(hour: number): number {
  if (!Number.isFinite(hour)) return DAY_BOUNDARY_HOUR;
  return Math.min(
    Math.max(Math.trunc(hour), DAY_BOUNDARY_MIN),
    DAY_BOUNDARY_MAX,
  );
}

/**
 * A lever's stable key.
 *
 * Widened from `"gym" | "food"` on 2026-07-28 for user-defined levers. Nothing
 * in this module cares what a lever is called: `upDates` keys on distinct
 * DATES, never on lever identity, so every figure derived here — the window,
 * the run, the down count, the intervals, the all-time totals — is unchanged by
 * the widening. That is why custom levers cost one type change rather than a
 * rewrite.
 *
 * The key is a slug and never changes once created; the human-facing label is
 * separate and freely renameable. See `levers.ts`.
 */
export type Lever = string;

export type Entry = {
  logged_for: string; // YYYY-MM-DD
  lever: Lever;
  detail: string | null;
};

export type Interval = {
  started_on: string;
  ended_on: string | null;
  days: number;
};

// --- date helpers -----------------------------------------------------------
// All dates are handled as YYYY-MM-DD strings in the user's timezone. We never
// construct a Date from a bare date string and rely on local parsing, because
// that silently shifts by a day depending on where the server is.

export function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * The logical date for a moment in time, in the given timezone, shifted so the
 * day rolls over at 04:00. A 01:30 gym session belongs to the day that just
 * ended, not the one that technically started.
 */
export function logicalDate(
  now: Date,
  timeZone: string,
  boundaryHour: number = DAY_BOUNDARY_HOUR,
): string {
  const shifted = new Date(
    now.getTime() - clampBoundaryHour(boundaryHour) * 3_600_000,
  );
  // en-CA formats as YYYY-MM-DD, which is what we want.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

/**
 * The same logical date, computed from the runtime's OWN clock, with no Intl.
 *
 * This exists because `logicalDate` cannot be trusted on React Native. Hermes
 * delegates Intl to platform ICU, and the results vary by Android version:
 * `Intl.DateTimeFormat` has been observed throwing `RangeError: Invalid
 * timezone name!` for valid IANA zones (hermes#572), ignoring the options
 * object entirely on API 21-23 (hermes#776), and reporting `UTC` from
 * `resolvedOptions().timeZone` because the device zone is never exposed.
 *
 * A silently wrong date is the worst failure this product has. Every screen,
 * the run length, the down count and the pager all key off it, and a one-day
 * shift is invisible until it has corrupted a month of history. So the mobile
 * client does not ask for a timezone at all: a phone's `Date` is already in the
 * user's local time, which is the timezone the day boundary actually means.
 *
 * Keep the two in agreement by writing the device's zone back to
 * `system_state.timezone`, so the server-side monitor pages on the same day
 * the phone is showing.
 */
export function logicalDateLocal(
  now: Date,
  boundaryHour: number = DAY_BOUNDARY_HOUR,
): string {
  const shifted = new Date(
    now.getTime() - clampBoundaryHour(boundaryHour) * 3_600_000,
  );
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Whether this runtime can be trusted with an explicit IANA `timeZone`.
 *
 * Deliberately strict: it checks that the engine echoes the zone back and that
 * the output actually parses as YYYY-MM-DD, because the observed Hermes
 * failure modes are silent-wrong rather than throwing. Use it to decide whether
 * to trust `logicalDate`, never to decide whether to show a date at all —
 * `logicalDateLocal` always works.
 */
export function hasTimeZoneSupport(timeZone: string): boolean {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    if (fmt.resolvedOptions().timeZone !== timeZone) return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(fmt.format(new Date(0)));
  } catch {
    return false;
  }
}

// --- core derivation --------------------------------------------------------

/** The set of dates that are "up" — at least one entry logged. */
export function upDates(entries: Entry[]): Set<string> {
  return new Set(entries.map((e) => e.logged_for));
}

/**
 * Days up within the trailing window ending at `today` (inclusive).
 *
 * This is the primary metric precisely because it degrades gracefully: three
 * missed days move 24/30 to 21/30. There is no sequence of events that takes
 * it to zero overnight, which is what makes it safe to put at the top of the
 * screen during a bad week.
 */
export function uptimeWindow(
  entries: Entry[],
  today: string,
  window = UPTIME_WINDOW,
): { up: number; total: number } {
  const up = upDates(entries);
  let count = 0;
  for (let i = 0; i < window; i++) {
    if (up.has(addDays(today, -i))) count++;
  }
  return { up: count, total: window };
}

/** Consecutive up-days ending today (or yesterday, if today isn't logged yet). */
export function currentRun(entries: Entry[], today: string): number {
  const up = upDates(entries);
  // Today being unlogged at 10am is not a broken run — it's an unfinished day.
  let cursor = up.has(today) ? today : addDays(today, -1);
  if (!up.has(cursor)) return 0;

  let n = 0;
  while (up.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/**
 * Consecutive days with no entry, as of today. Drives the fade monitor.
 *
 * Empty history is 0, never a large number: a system that has never been up
 * has not gone down. Counting from the beginning of time would greet a new
 * user with "DOWN 400 DAYS", which is precisely the framing this app exists
 * to avoid. Downtime is measured from the last known-good day.
 */
export function downDays(entries: Entry[], today: string): number {
  const up = upDates(entries);
  if (up.size === 0) return 0;
  if (up.has(today)) return 0;

  // Never count past the first entry — before that there was no system.
  const first = [...up].sort()[0];
  const span = daysBetween(first, today);

  let n = 0;
  let cursor = addDays(today, -1);
  // Today is not counted as down until it's over; the monitor counts whole
  // missed days only, so a quiet morning never pages you.
  while (!up.has(cursor) && n < span) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/**
 * Split history into runs (contiguous up-days) and outages (the gaps between
 * them). Both are first-class: an outage is an incident with a name, and a
 * finished run keeps its final length forever.
 */
export function deriveIntervals(
  entries: Entry[],
  today: string,
): { runs: Interval[]; outages: Interval[] } {
  const up = upDates(entries);
  const sorted = [...up].sort();
  if (sorted.length === 0) return { runs: [], outages: [] };

  const runs: Interval[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i];
    if (daysBetween(prev, d) > 1) {
      runs.push({
        started_on: start,
        ended_on: prev,
        days: daysBetween(start, prev) + 1,
      });
      start = d;
    }
    prev = d;
  }

  const lastIsCurrent = daysBetween(prev, today) <= 1;
  runs.push({
    started_on: start,
    ended_on: lastIsCurrent ? null : prev,
    days: daysBetween(start, prev) + 1,
  });

  const outages: Interval[] = [];
  for (let i = 0; i < runs.length - 1; i++) {
    const gapStart = addDays(runs[i].ended_on!, 1);
    const gapEnd = addDays(runs[i + 1].started_on, -1);
    outages.push({
      started_on: gapStart,
      ended_on: gapEnd,
      days: daysBetween(gapStart, gapEnd) + 1,
    });
  }

  // An ongoing outage: the last run ended and we haven't come back yet.
  const last = runs[runs.length - 1];
  if (last.ended_on !== null) {
    const gapStart = addDays(last.ended_on, 1);
    outages.push({
      started_on: gapStart,
      ended_on: null,
      days: daysBetween(gapStart, today),
    });
  }

  return { runs, outages };
}

/**
 * All-time figures. Every one of these is monotonic — no sequence of entries
 * or gaps can make them go down. During a bad week these are the truest
 * summary available, which is exactly when they matter.
 */
export function allTime(entries: Entry[], today: string) {
  const { runs } = deriveIntervals(entries, today);
  const totalDaysUp = upDates(entries).size;
  const longestRun = runs.reduce((max, r) => Math.max(max, r.days), 0);
  const completedRuns = runs.filter((r) => r.ended_on !== null).length;
  return { totalDaysUp, longestRun, completedRuns };
}

/** The most recently completed run — what the takeover reports instead of a zero. */
export function lastCompletedRun(
  entries: Entry[],
  today: string,
): Interval | null {
  const { runs } = deriveIntervals(entries, today);
  const completed = runs.filter((r) => r.ended_on !== null);
  return completed.length ? completed[completed.length - 1] : null;
}
