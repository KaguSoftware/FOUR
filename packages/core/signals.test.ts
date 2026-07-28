import { describe, expect, it } from "vitest";
import { DAILY_TREND_DAYS, dailyTrend, trendPath } from "./signals";

const s = (observed_on: string, value: number | null) => ({ observed_on, value });

describe("dailyTrend", () => {
  it("averages every kind logged on the same day into one point", () => {
    // energy 4 and sleep 2 on the same day is one day that averaged 3.
    const out = dailyTrend([s("2026-07-01", 4), s("2026-07-01", 2)]);
    expect(out).toEqual([{ date: "2026-07-01", avg: 3 }]);
  });

  it("sorts oldest first, so the last point is the most recent day", () => {
    const out = dailyTrend([s("2026-07-03", 5), s("2026-07-01", 1)]);
    expect(out.map((p) => p.date)).toEqual(["2026-07-01", "2026-07-03"]);
  });

  it("keeps the most recent window, not the first N days logged", () => {
    const many = Array.from({ length: 90 }, (_, i) =>
      s(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`, 3),
    );
    expect(dailyTrend(many).length).toBeLessThanOrEqual(DAILY_TREND_DAYS);
  });

  it("ignores null and non-finite values rather than plotting them as zero", () => {
    // A note row has value null. Treating it as 0 would drag the line down on
    // every day someone wrote something, which is the opposite of the truth.
    expect(dailyTrend([s("2026-07-01", null), s("2026-07-01", 4)])).toEqual([
      { date: "2026-07-01", avg: 4 },
    ]);
    expect(dailyTrend([s("2026-07-01", NaN)])).toEqual([]);
  });

  it("returns empty for no samples", () => {
    expect(dailyTrend([])).toEqual([]);
  });
});

describe("trendPath", () => {
  const box = { width: 300, height: 60 };

  it("puts the lowest value at the bottom and the highest at the top", () => {
    const pts = trendPath(
      [
        { date: "a", avg: 1 },
        { date: "b", avg: 5 },
      ],
      box,
    );
    expect(pts[0]).toEqual({ x: 0, y: 60 });
    expect(pts[1]).toEqual({ x: 300, y: 0 });
  });

  it("spreads points evenly across the width", () => {
    const pts = trendPath(
      ["a", "b", "c"].map((date) => ({ date, avg: 3 })),
      box,
    );
    expect(pts.map((p) => p.x)).toEqual([0, 150, 300]);
  });

  it("clamps out-of-scale values inside the box", () => {
    // A value outside 1..5 would otherwise draw outside the viewport and clip
    // against the container, which reads as a rendering fault.
    const pts = trendPath([{ date: "a", avg: 99 }], { ...box, width: 0 });
    expect(pts[0].y).toBe(0);
  });

  it("handles a single point without dividing by zero", () => {
    expect(trendPath([{ date: "a", avg: 3 }], box)).toEqual([
      { x: 0, y: 30 },
    ]);
  });

  it("returns nothing for an empty series", () => {
    expect(trendPath([], box)).toEqual([]);
  });
});
