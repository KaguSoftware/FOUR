/**
 * The felt-state trend.
 *
 * Lives here rather than in each client for the same reason everything else
 * does: two clients averaging the same samples differently is two answers to
 * "is this doing anything", and that question is the whole point of `/proof`.
 *
 * **This is NOT the reader that decides a plateau.** `evaluatePlateau` folds
 * into ISO weeks and must keep doing so — judged on raw days it fires after
 * four quiet ones, which is a mood, not a trend. Two readers, same data,
 * deliberately different cadence. Do not "fix" one to match the other.
 */

/** How many days the trend shows. 60 keeps every point ~5px at phone width. */
export const DAILY_TREND_DAYS = 60;

/**
 * Add a new piece of writing to a day that may already have some.
 *
 * The note field is a blank page every time you open it — being handed back
 * this morning's text to edit is not how a journal is used. But the write
 * upserts on `(user_id, observed_on, kind)`, so an empty field plus a save
 * would REPLACE what is already there. Appending is what makes both true: a
 * fresh place to write, and nothing lost.
 *
 * Separated by a blank line, so a day reads as the entries it actually was
 * rather than one run-on paragraph.
 *
 * `truncated` is returned rather than silently swallowed — losing writing
 * without saying so is the failure this whole function exists to avoid. In
 * practice a 6000-character day is far outside normal use.
 */
export function appendNote(
  existing: string | null | undefined,
  addition: string,
  max: number,
): { text: string; truncated: boolean } {
  const before = (existing ?? "").trim();
  const next = addition.trim();

  if (!next) return { text: before, truncated: false };
  if (!before) {
    return { text: next.slice(0, max), truncated: next.length > max };
  }

  const joined = `${before}\n\n${next}`;
  // Keeps the NEWEST writing when a day somehow overflows, because the thing
  // just typed is the thing the user is watching land.
  return joined.length <= max
    ? { text: joined, truncated: false }
    : { text: joined.slice(joined.length - max), truncated: true };
}

export type SignalSample = { observed_on: string; value: number | null };

export type TrendPoint = { date: string; avg: number };

/**
 * Collapse samples to one point per day, most recent last.
 *
 * Sampling is daily, so the trend plots daily. It is noisier than the weekly
 * average it replaced, and that noise is real data rather than a rendering
 * fault — a day that felt like a 2 was a 2.
 *
 * Several kinds land on the same day (energy and sleep), and they are averaged
 * together on purpose: the line is "how was that day", not two lines to read
 * against each other.
 */
export function dailyTrend(
  samples: readonly SignalSample[],
  days: number = DAILY_TREND_DAYS,
): TrendPoint[] {
  const byDay = new Map<string, number[]>();
  for (const s of samples) {
    if (s.value === null || !Number.isFinite(s.value)) continue;
    const list = byDay.get(s.observed_on) ?? [];
    list.push(s.value);
    byDay.set(s.observed_on, list);
  }

  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-days)
    .map(([date, vals]) => ({
      date,
      avg: vals.reduce((x, y) => x + y, 0) / vals.length,
    }));
}

/**
 * The polyline for a trend, in a 0..width by 0..height box.
 *
 * Returns plain points so each client draws with its own primitive — SVG on
 * web, react-native-svg on mobile — while the SHAPE is computed once here.
 */
export function trendPath(
  series: readonly TrendPoint[],
  opts: { width: number; height: number; min?: number; max?: number },
): { x: number; y: number }[] {
  const min = opts.min ?? 1;
  const max = opts.max ?? 5;
  if (series.length === 0) return [];

  const step = series.length > 1 ? opts.width / (series.length - 1) : 0;
  const span = max - min || 1;

  return series.map((s, i) => ({
    x: i * step,
    // Clamped so a value outside the expected scale cannot draw outside the
    // box and silently clip against the container.
    y:
      opts.height -
      ((Math.min(Math.max(s.avg, min), max) - min) / span) * opts.height,
  }));
}
