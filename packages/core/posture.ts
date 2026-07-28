/**
 * Alert posture — how the system talks to you.
 *
 * Framed as a severity policy rather than a "tone" setting, because a monitor
 * with a configurable severity policy is native to the metaphor. The user picks
 * it during onboarding and can change it at any time.
 *
 * THE LINE THAT KEEPS `soft` HONEST, and the reason this file is in core rather
 * than in a client: posture may change **wording**, and may let good news sound
 * like good news. It may not touch what counts as up, any number, the
 * escalation thresholds, or the anti-shame invariants.
 *
 * So everything here returns copy. Nothing here returns a number, a threshold,
 * or a boolean that gates a calculation — that is the constraint, expressed as
 * a type signature rather than a comment. `posture.test.ts` also scans every
 * string in this file for the vocabulary of gamification, so `soft` drifting
 * into badges and streaks fails the build.
 */

export const POSTURES = ["strict", "soft"] as const;

export type Posture = (typeof POSTURES)[number];

/** Blunt by default. Softening is a choice the user makes, not one we make. */
export const DEFAULT_POSTURE: Posture = "strict";

export function isPosture(value: unknown): value is Posture {
  return typeof value === "string" && (POSTURES as readonly string[]).includes(value);
}

/** Coerce anything (a database column, a form field) to a valid posture. */
export function toPosture(value: unknown): Posture {
  return isPosture(value) ? value : DEFAULT_POSTURE;
}

export type PostureChoice = {
  value: Posture;
  title: string;
  /** What actually changes. Stated plainly, so neither reads as the easy one. */
  detail: string;
};

export const POSTURE_CHOICES: readonly PostureChoice[] = [
  {
    value: "strict",
    title: "Strict",
    detail:
      "Flat register. A milestone reads like an alert. No comfort on a bad week.",
  },
  {
    value: "soft",
    title: "Soft",
    detail:
      "Same numbers, same thresholds. Warmer words, and good news is allowed to sound like good news.",
  },
];

/**
 * Shown under the choice. Load-bearing: without it `soft` reads as the easier
 * setting, and the whole point is that there is no easier setting.
 */
export const POSTURE_FOOTNOTE =
  "Either way the bar is identical. Change it any time in Settings.";

// --- takeover ---------------------------------------------------------------

/** Heads the re-entry options. The facts above it are identical in both. */
export function takeoverPrompt(posture: Posture): string {
  return posture === "soft" ? "Pick the lightest one" : "Minimum to get back up";
}

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

function spell(n: number): string {
  const i = Math.round(n);
  return i >= 0 && i < NUMBER_WORDS.length ? NUMBER_WORDS[i] : String(i);
}

/**
 * The one sentence `soft` adds to the takeover.
 *
 * `strict` returns null — not an empty string, so a client cannot render a
 * blank line where the sentence would be and shift the layout between postures.
 *
 * It names the break as ordinary and points at what still exists. It does not
 * re-report the number above it, and it never claims the run was long.
 */
export function takeoverNote(
  posture: Posture,
  opts: { down: number; hasLastRun: boolean },
): string | null {
  if (posture !== "soft") return null;

  const n = spell(opts.down);
  const unit = Math.round(opts.down) === 1 ? "day" : "days";
  const opening = `${n.charAt(0).toUpperCase()}${n.slice(1)} ${unit} is an outage, not a failure.`;

  // Only claimed when there is a completed run to point at. Telling someone
  // their run "doesn't go anywhere" when they have never finished one is a
  // sentence about nothing.
  return opts.hasLastRun
    ? `${opening} The run you already have doesn't go anywhere.`
    : opening;
}

// --- milestones -------------------------------------------------------------

export type MilestonePanel = { title: string; note: string };

/**
 * The acknowledgment `soft` is allowed to make, and the entire difference
 * between the two postures on a good day.
 *
 * `strict` returns null: the milestone still appears, in the identical flat
 * line an alert would use. That symmetry is what stops it reading as praise.
 *
 * It notices. It does not reward. There is no badge, no colour change, no
 * motion, and no number that only exists because a milestone fired.
 */
export function milestonePanel(
  posture: Posture,
  kind: string,
): MilestonePanel | null {
  if (posture !== "soft") return null;

  const run = /^run_(\d+)$/.exec(kind);
  if (run) {
    return {
      title: `${run[1]} days up`,
      note: `${run[1]} days without a gap. Worth noticing, then carry on.`,
    };
  }

  const uptime = /^uptime_(\d+)$/.exec(kind);
  if (uptime) {
    return {
      title: `${uptime[1]}% uptime`,
      note: `A month held above ${uptime[1]}%. Not a perfect month — a stable one.`,
    };
  }

  return null;
}
