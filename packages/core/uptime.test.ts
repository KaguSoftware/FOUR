import { describe, expect, it } from "vitest";
import {
  addDays,
  allTime,
  currentRun,
  deriveIntervals,
  downDays,
  lastCompletedRun,
  logicalDate,
  uptimeWindow,
  type Entry,
  logicalDateLocal,
  hasTimeZoneSupport,
} from "./uptime";

const entry = (logged_for: string, lever: "gym" | "food" = "gym"): Entry => ({
  logged_for,
  lever,
  detail: null,
});

/** Build entries for a contiguous span, inclusive. */
const span = (from: string, days: number): Entry[] =>
  Array.from({ length: days }, (_, i) => entry(addDays(from, i)));

describe("logicalDate — 04:00 boundary", () => {
  // Istanbul is UTC+3 year-round (no DST since 2016).
  const TZ = "Europe/Istanbul";

  it("counts a 01:30 session for the previous calendar day", () => {
    // 2026-07-20T01:30 in Istanbul is still "the 19th" to the user.
    const at = new Date("2026-07-19T22:30:00Z");
    expect(logicalDate(at, TZ)).toBe("2026-07-19");
  });

  it("rolls over at 04:00, not midnight", () => {
    const before = new Date("2026-07-20T00:59:00Z"); // 03:59 Istanbul
    const after = new Date("2026-07-20T01:01:00Z"); // 04:01 Istanbul
    expect(logicalDate(before, TZ)).toBe("2026-07-19");
    expect(logicalDate(after, TZ)).toBe("2026-07-20");
  });

  it("advances exactly one logical day per calendar day", () => {
    const days = new Set<string>();
    for (let h = 0; h < 72; h++) {
      days.add(logicalDate(new Date(Date.UTC(2026, 6, 1, h)), TZ));
    }
    const sorted = [...days].sort();
    for (let i = 1; i < sorted.length; i++) {
      expect(addDays(sorted[i - 1], 1)).toBe(sorted[i]);
    }
  });

  it("survives a DST transition in zones that have one", () => {
    // Kept for correctness if the timezone is ever changed while travelling:
    // Europe/Berlin springs forward 2026-03-29.
    const days = new Set<string>();
    for (let h = 0; h < 72; h++) {
      days.add(logicalDate(new Date(Date.UTC(2026, 2, 28, 12 + h)), "Europe/Berlin"));
    }
    const sorted = [...days].sort();
    for (let i = 1; i < sorted.length; i++) {
      expect(addDays(sorted[i - 1], 1)).toBe(sorted[i]);
    }
  });
});

describe("uptimeWindow", () => {
  it("is 0/30 on empty history", () => {
    expect(uptimeWindow([], "2026-07-19")).toEqual({ up: 0, total: 30 });
  });

  it("counts only days inside the window", () => {
    const entries = [entry("2026-07-19"), entry("2026-05-01")];
    expect(uptimeWindow(entries, "2026-07-19").up).toBe(1);
  });

  it("degrades gracefully — a 3-day gap is a dent, not a wipe", () => {
    const entries = span("2026-06-20", 30);
    const before = uptimeWindow(entries, "2026-07-19").up;
    const after = uptimeWindow(entries, "2026-07-22").up;
    expect(before).toBe(30);
    expect(after).toBe(27); // not 0 — this is the whole thesis
  });
});

describe("currentRun", () => {
  it("does not break the run just because today isn't logged yet", () => {
    const entries = span("2026-07-10", 9); // through 07-18
    expect(currentRun(entries, "2026-07-19")).toBe(9);
  });

  it("counts today when logged", () => {
    const entries = span("2026-07-10", 10); // through 07-19
    expect(currentRun(entries, "2026-07-19")).toBe(10);
  });

  it("is 0 after a real gap", () => {
    const entries = span("2026-07-01", 5);
    expect(currentRun(entries, "2026-07-19")).toBe(0);
  });
});

describe("downDays", () => {
  it("is 0 when today is logged", () => {
    expect(downDays([entry("2026-07-19")], "2026-07-19")).toBe(0);
  });

  it("is 0 on empty history — a system that never ran has not gone down", () => {
    // Regression: this once counted to its safety cap and greeted a brand-new
    // user with "DOWN 400 DAYS", the exact framing the app exists to avoid.
    expect(downDays([], "2026-07-19")).toBe(0);
  });

  it("never counts further back than the first entry", () => {
    // Up on the 10th; 11th–18th are whole missed days. Today is still in
    // progress, so it is not counted.
    const entries = [entry("2026-07-10")];
    expect(downDays(entries, "2026-07-19")).toBe(8);
  });

  it("does not count today as down — a quiet morning never pages you", () => {
    const entries = [entry("2026-07-18")];
    expect(downDays(entries, "2026-07-19")).toBe(0);
  });

  it("counts whole missed days", () => {
    const entries = [entry("2026-07-15")];
    // 16, 17, 18 missed; 19 is still in progress
    expect(downDays(entries, "2026-07-19")).toBe(3);
  });
});

describe("deriveIntervals", () => {
  it("splits history into runs and the outages between them", () => {
    const entries = [...span("2026-06-01", 10), ...span("2026-06-15", 5)];
    const { runs, outages } = deriveIntervals(entries, "2026-06-19");

    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({
      started_on: "2026-06-01",
      ended_on: "2026-06-10",
      days: 10,
    });
    expect(outages).toHaveLength(1);
    expect(outages[0]).toMatchObject({
      started_on: "2026-06-11",
      ended_on: "2026-06-14",
      days: 4,
    });
  });

  it("marks an ongoing run with ended_on null", () => {
    const entries = span("2026-07-10", 10); // through 07-19
    const { runs } = deriveIntervals(entries, "2026-07-19");
    expect(runs[runs.length - 1].ended_on).toBeNull();
  });

  it("reports an ongoing outage", () => {
    const entries = span("2026-07-01", 5); // through 07-05
    const { outages } = deriveIntervals(entries, "2026-07-19");
    const ongoing = outages[outages.length - 1];
    expect(ongoing.ended_on).toBeNull();
    expect(ongoing.started_on).toBe("2026-07-06");
  });
});

// ---------------------------------------------------------------------------
// The invariants that matter most. These encode the promise the whole app is
// built on: a break is an outage, never a wipe.
// ---------------------------------------------------------------------------
describe("anti-shame invariants", () => {
  it("a completed run keeps its final length — the app can say 31 days, not 0", () => {
    const entries = span("2026-06-12", 31); // through 07-12
    const last = lastCompletedRun(entries, "2026-07-19");
    expect(last).not.toBeNull();
    expect(last!.days).toBe(31);
    // and the fragile counter is zero at the same moment — which is precisely
    // why the UI shows the completed run instead.
    expect(currentRun(entries, "2026-07-19")).toBe(0);
  });

  it("all-time figures are monotonic across any sequence of days", () => {
    const entries = [
      ...span("2026-01-01", 40),
      ...span("2026-03-01", 12),
      ...span("2026-05-05", 60),
    ];
    let prevTotal = 0;
    let prevLongest = 0;
    for (let i = 0; i < 200; i++) {
      const today = addDays("2026-01-01", i);
      const visible = entries.filter((e) => e.logged_for <= today);
      const { totalDaysUp, longestRun } = allTime(visible, today);
      expect(totalDaysUp).toBeGreaterThanOrEqual(prevTotal);
      expect(longestRun).toBeGreaterThanOrEqual(prevLongest);
      prevTotal = totalDaysUp;
      prevLongest = longestRun;
    }
  });

  it("30-day uptime never drops more than 1/30 per elapsed day", () => {
    const entries = [...span("2026-01-01", 40), ...span("2026-03-01", 12)];
    let prev = uptimeWindow(entries, "2026-01-01").up;
    for (let i = 1; i < 150; i++) {
      const today = addDays("2026-01-01", i);
      const now = uptimeWindow(entries, today).up;
      expect(prev - now).toBeLessThanOrEqual(1);
      prev = now;
    }
  });

  it("a run that ended still appears in history after the outage that ended it", () => {
    const entries = [...span("2026-06-12", 31), ...span("2026-07-17", 3)];
    const { runs, outages } = deriveIntervals(entries, "2026-07-19");
    expect(runs.some((r) => r.days === 31 && r.ended_on !== null)).toBe(true);
    expect(outages.some((o) => o.days === 4)).toBe(true);
  });
});

describe("logicalDateLocal — the Intl-free path used on mobile", () => {
  // Node's Intl is reliable, so this asserts the two implementations agree.
  // If they ever diverge, the mobile client and the server-side monitor would
  // disagree about what day it is, which is the worst failure in the product.
  const runtimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  it("agrees with logicalDate for the runtime's own zone, across a full day", () => {
    for (let hour = 0; hour < 24; hour++) {
      const at = new Date(2026, 6, 15, hour, 30, 0);
      expect(logicalDateLocal(at)).toBe(logicalDate(at, runtimeZone));
    }
  });

  it("agrees across a month boundary", () => {
    for (const at of [
      new Date(2026, 6, 31, 23, 59, 0),
      new Date(2026, 7, 1, 0, 30, 0),
      new Date(2026, 7, 1, 3, 59, 0),
      new Date(2026, 7, 1, 4, 1, 0),
    ]) {
      expect(logicalDateLocal(at)).toBe(logicalDate(at, runtimeZone));
    }
  });

  it("puts a 01:30 session on the day that just ended", () => {
    const lateNight = new Date(2026, 6, 15, 1, 30, 0);
    expect(logicalDateLocal(lateNight)).toBe("2026-07-14");
  });

  it("rolls over at 04:00, not midnight", () => {
    expect(logicalDateLocal(new Date(2026, 6, 15, 3, 59, 0))).toBe("2026-07-14");
    expect(logicalDateLocal(new Date(2026, 6, 15, 4, 0, 0))).toBe("2026-07-15");
  });

  it("always produces a parseable YYYY-MM-DD", () => {
    for (const at of [
      new Date(2026, 0, 1, 0, 0, 0),
      new Date(2026, 11, 31, 23, 59, 59),
      new Date(2024, 1, 29, 12, 0, 0), // leap day
    ]) {
      expect(logicalDateLocal(at)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("hasTimeZoneSupport — the Hermes probe", () => {
  it("passes on a runtime with real ICU", () => {
    expect(hasTimeZoneSupport("Europe/Istanbul")).toBe(true);
  });

  it("fails closed on a bogus zone rather than throwing", () => {
    expect(hasTimeZoneSupport("Not/AZone")).toBe(false);
  });
});
