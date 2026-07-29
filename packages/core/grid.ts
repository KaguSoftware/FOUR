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

export const MAX_LEVERS = 4;

/**
 * A lever's lifespan, as dates.
 *
 * `archived_on` is null while the lever is still offered. Both ends are
 * inclusive of the day named: a lever created on the 3rd counts for the 3rd,
 * and one archived on the 9th counted for the 9th — it was there for most of
 * that day, and the alternative silently dims a day someone already lived.
 */
export type LeverSpan = {
  created_on: string;
  archived_on: string | null;
};

/**
 * How many levers existed on `date`.
 *
 * This is the denominator the grid shades against, and it is a function of the
 * day rather than of today. Using the CURRENT active count meant history
 * rewrote itself: adding a third lever turned every previously-complete
 * two-lever day from fully lit into two thirds, for a decision made afterwards.
 *
 * Never returns less than 1. A date before any lever existed has no shade to
 * compute anyway — there can be no entries on it — and returning 0 would only
 * hand a divide-by-zero to whatever asked.
 */
export function leversOn(spans: readonly LeverSpan[], date: string): number {
  let n = 0;
  for (const span of spans) {
    if (span.created_on > date) continue;
    if (span.archived_on !== null && span.archived_on < date) continue;
    n++;
  }
  return Math.max(1, Math.min(n, MAX_LEVERS));
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
