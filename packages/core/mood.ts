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

import { addDays } from "./uptime";

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

/** One day in the strip. `value` is null for a day that was never answered. */
export type MoodDay = {
  date: string;
  value: number | null;
};

/**
 * The last `days` days of mood, oldest first, ending on `today`.
 *
 * **A day with no reading is `null`, never `0`.** That distinction is the whole
 * design: the monitor drops an unsampled day rather than inventing one (see
 * `evaluatePlateau` — "absence of data is NOT a flat line"), and a client that
 * drew a skipped day at the floor would be telling someone a day was rough when
 * they simply did not answer. Renderers must draw the two differently.
 *
 * Every day in the window is present in the output whether or not it has a
 * reading, so the array index IS the position in the strip and a caller never
 * has to reconcile a sparse list against a calendar.
 *
 * **`mood` only.** The retired `energy` and `sleep` kinds are still in the
 * table and still render in the day sheet, but they were a 1–5 scale — putting
 * one in a 1–100 strip would draw a bar at a height that means nothing.
 *
 * In core rather than in a client for the reason the whole package exists: two
 * implementations of "the last seven days" is two answers to the same question.
 */
export function moodWeek(
  signals: readonly { observed_on: string; kind: string; value: number | null }[],
  today: string,
  days = 7,
): MoodDay[] {
  const span = Math.max(Math.trunc(days), 1);

  // Indexed once rather than scanned per day. Later rows win, which matches the
  // table's own `unique (user_id, observed_on, kind)` — there can only be one.
  const byDate = new Map<string, number | null>();
  for (const s of signals) {
    if (s.kind !== MOOD_KIND) continue;
    byDate.set(s.observed_on, s.value);
  }

  const out: MoodDay[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({ date, value: byDate.get(date) ?? null });
  }
  return out;
}

/**
 * How tall a bar should be drawn, 0..1, with a floor for an answered day.
 *
 * **`MOOD_MIN` is 1, not 0**, so `moodFraction` maps the lowest real reading to
 * exactly 0 — and a bar drawn at literal zero height is indistinguishable from
 * a day nobody answered, which is the one distinction the strip exists to make.
 * An answered day therefore never falls below `floor`; `null` returns 0 and the
 * client draws its own "skipped" treatment.
 */
export function moodBarHeight(value: number | null, floor = 0.12): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return floor + moodFraction(value) * (1 - floor);
}
