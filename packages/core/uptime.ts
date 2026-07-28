/**
 * Uptime derivation.
 *
 * Everything in this module is computed from a set of dates. Nothing is
 * stored, nothing is incremented, nothing can be reset. That is the whole
 * point: there is no counter to zero out, so the system is structurally
 * incapable of telling you to start over.
 */

export const UPTIME_WINDOW = 30;
export const DAY_BOUNDARY_HOUR = 4;

export type Lever = "gym" | "food";

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
export function logicalDate(now: Date, timeZone: string): string {
  const shifted = new Date(now.getTime() - DAY_BOUNDARY_HOUR * 3_600_000);
  // en-CA formats as YYYY-MM-DD, which is what we want.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
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
