/**
 * The daily mood reading, and the face that draws it.
 *
 * Replaces the two 1–5 scales (energy, sleep) that used to live on `/proof`.
 * Those asked two questions on a screen you had to navigate to, and answered
 * neither for anyone who did not go looking. One slider on Home, next to the
 * levers, is the same reading at a fraction of the cost.
 *
 * **It is continuous, not five steps.** A five-step control is a rating, and a
 * rating invites the question "what does a 3 mean". A slider you drag until
 * the face looks right asks nothing and means exactly what it looks like.
 *
 * **Nothing here can affect uptime.** A day is up if a lever fired; the mood
 * is a note about that day, not a judgement of it, and skipping it costs
 * nothing. See PRODUCT.md.
 *
 * The GEOMETRY lives here rather than in each client for the same reason
 * `trendPath` did: two clients drawing their own faces are two answers to
 * "what does a 60 look like", and the whole point of this package is that
 * there is one. Clients supply the primitive (SVG on web, react-native-svg on
 * mobile); the shape is computed once, here.
 */

/** Both ends inclusive. Matches the `signals_value_check` bound for `mood`. */
export const MOOD_MIN = 1;
export const MOOD_MAX = 100;

/**
 * The kind written to `signals`. Its own kind rather than reusing `energy`,
 * because the scales differ (1–5 against 1–100) and a row whose meaning
 * depends on when it was written is a row nobody can read later.
 */
export const MOOD_KIND = "mood";

/** Dead centre — a flat mouth. What an untouched slider rests at. */
export const MOOD_NEUTRAL = Math.round((MOOD_MIN + MOOD_MAX) / 2);

export type Face = {
  /** SVG path data for the mouth, in a 0..1 × 0..1 box. */
  mouth: string;
  /** The two eyes, in the same box. */
  eyes: readonly { cx: number; cy: number; r: number }[];
  /**
   * The head — a rounded square, in the same box.
   *
   * The face used to be eyes and a mouth floating in empty space, which read as
   * marks on the page rather than as a face. A square head is also the shape
   * this app already draws everywhere else: every cell of the day grid and
   * every cell of the pixel wall is a rounded square, so the face belongs to
   * the same family instead of importing a circle nothing else uses.
   */
  head: { x: number; y: number; size: number; radius: number };
};

/** `value` mapped to 0..1, clamped. Non-finite reads as neutral, never NaN. */
export function moodFraction(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  const span = MOOD_MAX - MOOD_MIN;
  return Math.min(Math.max((value - MOOD_MIN) / span, 0), 1);
}

/** The stored integer for a 0..1 position. The inverse of `moodFraction`. */
export function moodValue(fraction: number): number {
  if (!Number.isFinite(fraction)) return MOOD_NEUTRAL;
  const f = Math.min(Math.max(fraction, 0), 1);
  return Math.round(MOOD_MIN + f * (MOOD_MAX - MOOD_MIN));
}

// Geometry, in the 0..1 box. Named so the numbers below are readable.
const EYE_Y = 0.36;
const EYE_R = 0.055;
const EYE_X = 0.31;
const MOUTH_Y = 0.66;
const MOUTH_HALF_W = 0.24;

/**
 * The head, inset from the box so its own stroke has room.
 *
 * A stroked path is centred on its coordinates, so a head flush to the 0..1
 * edges loses the outer half of its line to the viewBox at every size. The
 * inset is half the largest stroke either client draws, rounded up.
 *
 * The corner radius is a fraction of the side rather than an absolute, so it
 * scales with the face and matches `radius.md` on the day grid's cells at the
 * sizes this is actually drawn.
 */
const HEAD_INSET = 0.045;
const HEAD_RADIUS = 0.16;
/** How far the mouth's control point travels between full frown and full smile. */
const MOUTH_BOW = 0.46;

/**
 * The face for a mood.
 *
 * The mouth is one quadratic curve whose control point slides vertically: below
 * the endpoints it bows downward into a frown, above them into a smile, and at
 * the endpoints' own height it is a flat line. That is the entire animation —
 * one number moving — which is what keeps the two clients honest and what lets
 * the face track a finger at 60fps without recomputing anything but a `d`
 * string.
 *
 * **It is deliberately not a caricature.** No tears at 1, no grin at 100, no
 * colour change. DESIGN.md's register forbids triumph, and a face that
 * celebrates a good day implies it is scolding you on a bad one — on the one
 * control in the app whose whole purpose is that answering it honestly is
 * free.
 *
 * The box is 0..1 on both axes so a client can scale it to whatever size it
 * has. Nothing here knows about pixels.
 */
export function facePath(value: number): Face {
  const f = moodFraction(value);

  // SVG Y grows DOWNWARD. A smile bows below the mouth line (larger y), a
  // frown above it (smaller y). The first cut of this had the sign flipped —
  // written y-up, so 1 drew the frown — and shipped that way; the fix is
  // this comment's reason to exist.
  //   f = 0   → control above the line (frown)
  //   f = 0.5 → exactly on it (flat)
  //   f = 1   → below it (smile)
  const control = MOUTH_Y - MOUTH_BOW * (0.5 - f);

  const left = 0.5 - MOUTH_HALF_W;
  const right = 0.5 + MOUTH_HALF_W;

  // A quadratic curve's rendered extreme is only half the distance to its
  // control point, which is why MOUTH_BOW is roughly twice the visible bow.
  const mouth = `M ${round(left)} ${round(MOUTH_Y)} Q 0.5 ${round(control)} ${round(right)} ${round(MOUTH_Y)}`;

  return {
    mouth,
    eyes: [
      { cx: EYE_X, cy: EYE_Y, r: EYE_R },
      { cx: 1 - EYE_X, cy: EYE_Y, r: EYE_R },
    ],
    head: {
      x: HEAD_INSET,
      y: HEAD_INSET,
      size: round(1 - 2 * HEAD_INSET),
      radius: HEAD_RADIUS,
    },
  };
}

/** Three decimals is well under a pixel at any size either client draws. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * What the slider announces.
 *
 * A screen reader gets a word, not a number out of a hundred — "how was today"
 * answered with "sixty-three" is not an answer. The bands are deliberately
 * coarse and deliberately flat: none of them praise or scold.
 */
export function moodLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "not set";
  const f = moodFraction(value);
  if (f < 0.2) return "rough";
  if (f < 0.4) return "low";
  if (f < 0.6) return "flat";
  if (f < 0.8) return "decent";
  return "good";
}
