/**
 * Day-grid fill ramp.
 *
 * Lives in core rather than in each client because two clients computing their
 * own ramp is two answers to "how did that day look", and the whole point of
 * this package is that there is one.
 *
 * The ramp is generated per lever count: steps spaced evenly in OKLCH L — which
 * is already perceptually uniform — from a floor of 0.51 to 0.95 (ink). Values
 * are pre-resolved to sRGB hex here so every client renders identical cells.
 *
 * Why the floor is 0.51 and not lower: the binding constraint is separation
 * from a DOWN cell, not from the background. At L 0.49 the dimmest up-day
 * measured 2.83:1 against a down cell, and up-versus-down is the single most
 * important read in the grid. At 0.51 it measures 3.07:1 (and 3.31:1 against
 * the ground). Re-measure against the down cell before changing any of this.
 *
 * Honest limit: at four levers, adjacent steps separate by only 1.62:1, so the
 * grid reads as "more or less filled" rather than as an exact count. Two levers
 * separate by 4.99:1 and read cleanly. Down cells also carry a border that up
 * cells do not, so state never rests on fill alone.
 */

export const MAX_LEVERS = 4;

type LeverCount = 1 | 2 | 3 | 4;

const RAMPS: Readonly<Record<LeverCount, readonly string[]>> = {
  1: ["#eceff1"],
  2: ["#63666b", "#eceff1"],
  3: ["#63666b", "#a4a8ad", "#eceff1"],
  4: ["#63666b", "#8f9397", "#babec3", "#eceff1"],
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
 * Note: the ramp scales to the CURRENT lever count, so adding a lever re-shades
 * past days (a day that was "all levers" becomes "2 of 3"). Up/down status and
 * every number are untouched — only the shade moves. See HANDOFF.
 */
export function gridFill(fired: number, leverCount: number): string | null {
  if (!Number.isFinite(fired) || fired <= 0) return null;
  const ramp = gridRamp(leverCount);
  const step = Math.min(Math.round(fired), ramp.length);
  return ramp[step - 1];
}
