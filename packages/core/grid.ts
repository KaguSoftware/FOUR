/**
 * Day-grid fill ramp.
 *
 * Lives in core rather than in each client because two clients generating their
 * own shades would be two answers to "how did that day look", and the whole
 * point of this package is that there is one.
 *
 * **The cell is never divided — only dimmed.** A fractional bar draws the
 * remainder as a visible hole, and a hole reads as *you did not finish*, which
 * is the one thing this grid must never say. A dim cell is still a whole cell.
 * That is the distinction that makes a ramp acceptable where a level meter is
 * not, and it is why the fill below is a colour rather than a height.
 *
 * **Lightness is proportional to `fired / leverCount`** — two of three levers is
 * two thirds of the way up. `L = 0.51 + (fired / leverCount) * 0.44`, so the
 * scale is anchored at the 0.51 floor and tops out at ink's 0.95. Chroma eases
 * from 0.008 to ink's 0.004 across the same span. Values are pre-resolved to
 * sRGB hex here so every client renders identical cells; they were generated
 * with the same oklch→sRGB conversion `scripts/check-contrast.mjs` uses, and
 * every ratio in the comments below is measured rather than estimated.
 *
 * Why the floor is 0.51: the binding constraint is separation from a DOWN cell,
 * not from the background. Nothing ever renders AT the floor now — zero levers
 * is a down day — so the dimmest thing actually drawn is one of four at L 0.62,
 * which measures **4.83:1 against a down cell**. The previous ramp put its
 * dimmest step on the floor itself at 3.07:1, so the most important read in the
 * grid got better with this change, not worse.
 *
 * Honest limit, unchanged in kind: at four levers adjacent steps separate by
 * 1.41–1.53:1, so a four-lever grid reads as *more or less filled* at a glance
 * rather than as an exact count. Two levers separate by 2.07:1 and read
 * cleanly. Down cells also carry a border that up cells do not, so state never
 * rests on fill alone.
 */

import { addDays } from "./uptime";

export const MAX_LEVERS = 4;

/**
 * The first day of Home's trailing block.
 *
 * `max(firstDay, today - (days - 1))`, and that single expression is the whole
 * behaviour — there is deliberately no mode to be in.
 *
 * **Why it is not simply `today - 29`.** That is a rolling window, and on a new
 * account a rolling window is read backwards. Three days in, twenty-seven cells
 * are blank and the three real ones sit at the BOTTOM-RIGHT, so the block reads
 * as filling upward from the end; worse, every cell moves one place left
 * overnight, so the day you logged yesterday is not where you left it. Someone
 * with three days of history is exactly the person who most needs the grid to
 * say *you have started*, and it was saying *you are nearly all gap*.
 *
 * Pinning to day one puts the first day in the first cell. Days after `today`
 * are the caller's `future` treatment — drawn as nothing, the same as a
 * calendar's trailing pad, because a day that has not happened is not a day
 * that was missed.
 *
 * Once there are `days` of history the pin is behind the rolling edge and this
 * returns `today - (days - 1)` forever after. The transition needs no handling:
 * on the 30th day both branches give the same date.
 *
 * **The hero does not do this.** `uptimeWindow` stays a true rolling window —
 * see its docblock. The grid answers "what have I done so far"; the number
 * answers "is the system up".
 */
export function windowStart(
  firstDay: string | null,
  today: string,
  days = 30,
): string {
  const rolling = addDays(today, -(days - 1));
  // Nothing logged, or a `firstDay` in the future — a clock skew, or seeded
  // data. Either way the block starts today: one live cell and twenty-nine
  // that have not happened. It must never start LATER than today, or the grid
  // has no present.
  const pin = firstDay === null || firstDay > today ? today : firstDay;
  return pin > rolling ? pin : rolling;
}

/**
 * A lever's lifespan, as dates.
 *
 * `created_on` counts from that day **inclusive**; `archived_on` stops counting
 * from that day **exclusive**, and is null while the lever is still offered.
 *
 * Archiving being exclusive is a deliberate asymmetry. Counting a lever on the
 * day it was archived means the day you tidy up is a day you cannot fill: two
 * levers left, both logged, and the cell still reads two-of-three because the
 * one you just removed is still in the denominator. Nobody reads that as
 * correct.
 */
export type LeverSpan = {
  created_on: string;
  archived_on: string | null;
};

/** Levers whose span contains `date`. Raw — 0 means "nothing known". */
function spanning(spans: readonly LeverSpan[], date: string): number {
  let n = 0;
  for (const span of spans) {
    if (span.created_on > date) continue;
    if (span.archived_on !== null && span.archived_on <= date) continue;
    n++;
  }
  return n;
}

/**
 * How many levers you had on `date`.
 *
 * This is the denominator the grid shades against, and it is a function of the
 * day rather than of today. Using the CURRENT active count meant history
 * rewrote itself: adding a third lever turned every previously-complete
 * two-lever day from fully lit into two thirds, for a decision made afterwards.
 *
 * **The hard part is dates we know nothing about, and getting it wrong is what
 * shipped first.** `levers.created_at` records when the ROW was written, not
 * when the lever entered someone's life — the migration that introduced the
 * table backfilled every existing lever with the timestamp of the migration
 * itself. Months of real entries sit before that stamp. The first version
 * floored the answer at 1 on the reasoning that a day before any lever existed
 * could have no entries on it, which is simply false for those rows, and the
 * result was that every one of those days rendered as one-of-one: a day where
 * you did half of what you had came out fully lit.
 *
 * So there is no floor of 1 here. Before the earliest thing we know about, the
 * answer is the earliest lever set we DO know about, projected backwards. That
 * is a guess, but it is the *right* guess — someone with two levers today
 * almost certainly had two last month — and unlike `1` it is never a
 * fabricated fact that turns a half-finished day into a complete one.
 */
export function leversOn(spans: readonly LeverSpan[], date: string): number {
  const now = spanning(spans, date);
  if (now > 0) return Math.min(now, MAX_LEVERS);

  // Nothing spans this date. Either it predates every lever, or the account has
  // none at all.
  let earliest: string | null = null;
  for (const span of spans) {
    if (earliest === null || span.created_on < earliest) earliest = span.created_on;
  }
  if (earliest === null) return 1;

  // Only project backwards. A date AFTER everything was archived genuinely has
  // no levers, and inventing some would dim a day that was legitimately full.
  if (date > earliest) return 1;

  return Math.min(Math.max(spanning(spans, earliest), 1), MAX_LEVERS);
}

type LeverCount = 1 | 2 | 3 | 4;

const RAMPS: Readonly<Record<LeverCount, readonly string[]>> = {
  1: ["#eceff1"],
  2: ["#a5a8ab", "#eceff1"],
  3: ["#8e9295", "#bcbfc2", "#eceff1"],
  4: ["#83868a", "#a5a8ab", "#c8cbce", "#eceff1"],
};

function clampLevers(n: number): LeverCount {
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.round(n), 1), MAX_LEVERS) as LeverCount;
}

/** The full ramp for a lever count, dimmest first. Always `leverCount` long. */
export function gridRamp(leverCount: number): readonly string[] {
  return RAMPS[clampLevers(leverCount)];
}

/**
 * Fill for a day where `fired` levers were logged out of `leverCount` active.
 *
 * Returns `null` for a down day — the client draws its own unlit cell, because
 * a down cell is a surface plus a border rather than a fill, and that border is
 * what keeps state from resting on colour alone.
 *
 * **`leverCount` is the count for THAT DAY, not today's.** Pass
 * `leversOn(spans, date)`. Passing the current active count re-shades history
 * every time a lever is added, which is a stored-counter problem wearing a
 * different hat: a past day changing because of something you did afterwards.
 */
export function gridFill(fired: number, leverCount: number): string | null {
  if (!Number.isFinite(fired) || fired <= 0) return null;
  const ramp = gridRamp(leverCount);
  const step = Math.min(Math.round(fired), ramp.length);
  return ramp[step - 1];
}
