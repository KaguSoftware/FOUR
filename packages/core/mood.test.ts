import { describe, expect, it } from "vitest";
import {
  facePath,
  MOOD_MAX,
  MOOD_MIN,
  MOOD_NEUTRAL,
  moodBarHeight,
  moodFraction,
  moodLabel,
  moodValue,
  moodWeek,
} from "./mood";

/** The Q control point's Y, which is the only number that moves. */
function controlY(value: number): number {
  const m = /Q 0\.5 (-?[\d.]+) /.exec(facePath(value).mouth);
  if (!m) throw new Error(`unparseable mouth: ${facePath(value).mouth}`);
  return Number(m[1]);
}

describe("moodFraction / moodValue", () => {
  it("maps the ends to 0 and 1", () => {
    expect(moodFraction(MOOD_MIN)).toBe(0);
    expect(moodFraction(MOOD_MAX)).toBe(1);
  });

  it("clamps rather than escaping the box", () => {
    expect(moodFraction(-50)).toBe(0);
    expect(moodFraction(9999)).toBe(1);
  });

  it("reads a non-finite value as neutral instead of NaN", () => {
    // A slider mid-gesture and an empty field both produce these. NaN would
    // reach the path string and render nothing at all.
    expect(moodFraction(NaN)).toBe(0.5);
    expect(moodFraction(Infinity)).toBe(0.5);
  });

  it("round-trips through moodValue", () => {
    for (const v of [1, 12, 50, 63, 99, 100]) {
      expect(moodValue(moodFraction(v))).toBe(v);
    }
  });

  it("keeps moodValue inside the stored bound", () => {
    // The DB constraint is `between 1 and 100`; a value outside it is a
    // rejected write, which the slider would report as a failed save.
    expect(moodValue(0)).toBe(MOOD_MIN);
    expect(moodValue(1)).toBe(MOOD_MAX);
    expect(moodValue(-3)).toBe(MOOD_MIN);
    expect(moodValue(7)).toBe(MOOD_MAX);
    expect(moodValue(NaN)).toBe(MOOD_NEUTRAL);
  });
});

describe("facePath", () => {
  it("is flat at the midpoint", () => {
    // The control point sits exactly on the mouth line, so the curve is a
    // straight one. This is what an untouched slider draws.
    const flat = facePath(MOOD_NEUTRAL);
    const [, , , y] = /M ([\d.]+) ([\d.]+) Q 0\.5 ([\d.]+) /.exec(flat.mouth)!;
    expect(Number(y)).toBeCloseTo(controlY(MOOD_NEUTRAL), 2);
  });

  it("frowns at the bottom and smiles at the top", () => {
    // SVG Y grows downward: a frown bows ABOVE the mouth line (smaller y), a
    // smile below it (larger y). The first version of this test asserted the
    // opposite — reasoning y-up — and green-lit a face that smiled at 1.
    expect(controlY(MOOD_MIN)).toBeLessThan(controlY(MOOD_NEUTRAL));
    expect(controlY(MOOD_MAX)).toBeGreaterThan(controlY(MOOD_NEUTRAL));
  });

  it("moves monotonically across the whole range", () => {
    // The face must never reverse direction mid-drag — it tracks a finger, and
    // a mouth that dips back down at 70 reads as a bug in the control.
    let prev = -Infinity;
    for (let v = MOOD_MIN; v <= MOOD_MAX; v++) {
      const y = controlY(v);
      expect(y).toBeGreaterThan(prev);
      prev = y;
    }
  });

  it("stays inside the unit box at both extremes", () => {
    // Clients scale this box to whatever size they have; a coordinate outside
    // 0..1 clips against the container instead of drawing.
    for (const v of [MOOD_MIN, 25, 50, 75, MOOD_MAX]) {
      const face = facePath(v);
      const nums = face.mouth.match(/-?[\d.]+/g)!.map(Number);
      for (const n of nums) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
      for (const eye of face.eyes) {
        expect(eye.cx - eye.r).toBeGreaterThan(0);
        expect(eye.cx + eye.r).toBeLessThan(1);
        expect(eye.cy - eye.r).toBeGreaterThan(0);
      }
    }
  });

  it("clamps out-of-range values instead of drawing off the face", () => {
    expect(facePath(-40).mouth).toBe(facePath(MOOD_MIN).mouth);
    expect(facePath(400).mouth).toBe(facePath(MOOD_MAX).mouth);
  });

  it("keeps the eyes fixed — only the mouth carries the reading", () => {
    expect(facePath(MOOD_MIN).eyes).toEqual(facePath(MOOD_MAX).eyes);
  });

  it("is deterministic, so both clients draw the same face", () => {
    expect(facePath(63)).toEqual(facePath(63));
  });
});

describe("moodLabel", () => {
  it("says so when nothing has been set", () => {
    expect(moodLabel(null)).toBe("not set");
    expect(moodLabel(NaN)).toBe("not set");
  });

  it("bands the range into words, not a score out of a hundred", () => {
    expect(moodLabel(1)).toBe("rough");
    expect(moodLabel(30)).toBe("low");
    expect(moodLabel(50)).toBe("flat");
    expect(moodLabel(70)).toBe("decent");
    expect(moodLabel(100)).toBe("good");
  });

  it("never praises or scolds", () => {
    // The register is flat by design — see DESIGN.md. A control that is free to
    // skip cannot also be one that judges the answer.
    const words = [1, 25, 50, 75, 100].map(moodLabel).join(" ");
    expect(words).not.toMatch(/great|bad|awful|amazing|well done|poor/i);
  });
});

describe("moodWeek", () => {
  const sig = (observed_on: string, value: number | null, kind = "mood") => ({
    observed_on,
    kind,
    value,
  });

  it("returns the window oldest-first, ending on today", () => {
    const week = moodWeek([], "2026-08-04");
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe("2026-07-29");
    expect(week[6].date).toBe("2026-08-04");
  });

  it("places each reading on its own day", () => {
    const week = moodWeek(
      [sig("2026-08-02", 40), sig("2026-08-04", 80)],
      "2026-08-04",
    );
    expect(week[4].date).toBe("2026-08-02");
    expect(week[4].value).toBe(40);
    expect(week[6].value).toBe(80);
    // The days between stay unanswered rather than being filled in.
    expect(week[5].value).toBeNull();
  });

  it("gives an unanswered day NULL, never zero", () => {
    // The load-bearing case. A skipped day is not a bad day: the monitor drops
    // it rather than inventing one, and a client must be able to draw the
    // difference.
    const week = moodWeek([sig("2026-08-04", 60)], "2026-08-04");
    expect(week[0].value).toBeNull();
    expect(week[0].value).not.toBe(0);
    expect(week.filter((d) => d.value === null)).toHaveLength(6);
  });

  it("ignores the retired 1-5 kinds", () => {
    // An `energy` of 4 drawn on a 1-100 strip is a bar at a height that means
    // nothing on either scale.
    const week = moodWeek(
      [sig("2026-08-04", 4, "energy"), sig("2026-08-03", 3, "sleep")],
      "2026-08-04",
    );
    expect(week.every((d) => d.value === null)).toBe(true);
  });

  it("ignores days outside the window", () => {
    const week = moodWeek(
      [sig("2026-07-01", 99), sig("2026-08-05", 99)],
      "2026-08-04",
    );
    expect(week.every((d) => d.value === null)).toBe(true);
  });

  it("takes a custom length", () => {
    expect(moodWeek([], "2026-08-04", 14)).toHaveLength(14);
    // Never zero-length: a strip with no days is not a thing a client can draw.
    expect(moodWeek([], "2026-08-04", 0)).toHaveLength(1);
  });
});

describe("moodBarHeight", () => {
  it("keeps the lowest real reading visible", () => {
    // MOOD_MIN maps to fraction 0, so without a floor the lowest answer would
    // draw a zero-height bar — identical to a day nobody answered.
    expect(moodBarHeight(MOOD_MIN)).toBeGreaterThan(0);
    expect(moodBarHeight(MOOD_MIN)).toBeCloseTo(0.12, 5);
  });

  it("gives an unanswered day no height at all", () => {
    expect(moodBarHeight(null)).toBe(0);
  });

  it("puts the top of the scale at full height", () => {
    expect(moodBarHeight(MOOD_MAX)).toBeCloseTo(1, 5);
  });

  it("never lets an answered day fall to a skipped day's height", () => {
    for (let v = MOOD_MIN; v <= MOOD_MAX; v++) {
      expect(moodBarHeight(v)).toBeGreaterThan(moodBarHeight(null));
    }
  });
});
