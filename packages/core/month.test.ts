import { describe, expect, it } from "vitest";
import {
  addMonths,
  monthGrid,
  monthUptime,
  monthsBetween,
  WEEKDAY_INITIALS,
} from "./month";
import type { Entry } from "./uptime";

/** Every non-null cell, in order. */
const dates = (iso: string) => monthGrid(iso).cells.filter((c) => c !== null);

describe("monthGrid", () => {
  it("reports the real length of the month, not a fixed window", () => {
    // The bug this exists to fix: on the 29th of a 31-day month the grid
    // showed the last day of a 30-day one.
    expect(monthGrid("2026-07-29")).toMatchObject({
      label: "July",
      daysInMonth: 31,
      dayOfMonth: 29,
    });
    expect(monthGrid("2026-06-15").daysInMonth).toBe(30);
    expect(monthGrid("2026-02-01").daysInMonth).toBe(28);
  });

  it("handles February in a leap year", () => {
    expect(monthGrid("2028-02-10").daysInMonth).toBe(29);
    expect(dates("2028-02-10").at(-1)).toBe("2028-02-29");
  });

  it("emits every day of the month exactly once, in order", () => {
    const cells = dates("2026-07-29");
    expect(cells).toHaveLength(31);
    expect(cells[0]).toBe("2026-07-01");
    expect(cells.at(-1)).toBe("2026-07-31");
    expect(new Set(cells).size).toBe(31);
  });

  it("gives the same grid for every day in the same month", () => {
    // Only `dayOfMonth` may differ — the cells are a property of the month.
    const a = monthGrid("2026-07-01");
    const b = monthGrid("2026-07-31");
    expect(a.cells).toEqual(b.cells);
    expect(a.dayOfMonth).toBe(1);
    expect(b.dayOfMonth).toBe(31);
  });

  it("pads to whole Monday-first weeks", () => {
    for (const iso of ["2026-07-15", "2026-02-15", "2026-11-15", "2028-02-15"]) {
      const { cells } = monthGrid(iso);
      expect(cells.length % 7).toBe(0);
    }
  });

  it("puts the 1st in the column its weekday actually falls on", () => {
    // 2026-07-01 is a Wednesday: index 2 in a Monday-first week.
    expect(monthGrid("2026-07-01").cells.indexOf("2026-07-01")).toBe(2);
    // 2026-06-01 is a Monday — no leading padding at all.
    expect(monthGrid("2026-06-01").cells[0]).toBe("2026-06-01");
  });

  it("does not shift a month that starts on a Sunday", () => {
    // The Sunday-first-to-Monday-first conversion is where this breaks, and it
    // is invisible in any month starting on a Monday. 2026-11-01 is a Sunday,
    // so it belongs in the LAST column, with six pad cells before it.
    const { cells } = monthGrid("2026-11-01");
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toBe("2026-11-01");
    expect(WEEKDAY_INITIALS[6]).toBe("S");
  });

  it("pads only at the ends, never in the middle", () => {
    const { cells } = monthGrid("2026-11-15");
    const first = cells.findIndex((c) => c !== null);
    const last = cells.length - 1 - [...cells].reverse().findIndex((c) => c !== null);
    expect(cells.slice(first, last + 1).every((c) => c !== null)).toBe(true);
  });

  it("crosses a year boundary without drifting", () => {
    expect(monthGrid("2026-12-31")).toMatchObject({
      label: "December",
      daysInMonth: 31,
    });
    expect(dates("2027-01-01")[0]).toBe("2027-01-01");
  });

  it("throws on a malformed date rather than inventing a month", () => {
    expect(() => monthGrid("2026-7-1")).toThrow();
    expect(() => monthGrid("not a date")).toThrow();
    expect(() => monthGrid("")).toThrow();
  });

  it("reports the year and month as numbers", () => {
    // The bare label cannot distinguish two Julys, which a stack of months
    // spanning a new year will contain.
    expect(monthGrid("2026-07-29")).toMatchObject({ year: 2026, month: 7 });
    expect(monthGrid("2027-01-01")).toMatchObject({ year: 2027, month: 1 });
  });
});

describe("addMonths", () => {
  it("steps forward and back within a year", () => {
    expect(addMonths("2026-07-15", 1)).toBe("2026-08-15");
    expect(addMonths("2026-07-15", -1)).toBe("2026-06-15");
    expect(addMonths("2026-07-15", 0)).toBe("2026-07-15");
  });

  it("crosses year boundaries in both directions", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-07-15", -12)).toBe("2025-07-15");
    expect(addMonths("2026-07-15", 18)).toBe("2028-01-15");
  });

  it("clamps to the target month rather than rolling into the next one", () => {
    // The whole reason this is not one-line date maths: naive UTC arithmetic
    // turns 31 March minus a month into 3 March, which SKIPS February — a
    // month stack would silently lose a month and look fine doing it.
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-08-31", 1)).toBe("2026-09-30");
  });

  it("clamps to 29 in a leap February", () => {
    expect(addMonths("2028-03-31", -1)).toBe("2028-02-29");
  });

  it("throws on a malformed date", () => {
    expect(() => addMonths("2026-7-1", 1)).toThrow();
    expect(() => addMonths("", 1)).toThrow();
  });
});

describe("monthsBetween", () => {
  it("returns one first-of-month anchor per month, newest first", () => {
    expect(monthsBetween("2026-05-14", "2026-08-02")).toEqual([
      "2026-08-01",
      "2026-07-01",
      "2026-06-01",
      "2026-05-01",
    ]);
  });

  it("returns a single month when both ends are in it", () => {
    expect(monthsBetween("2026-07-01", "2026-07-31")).toEqual(["2026-07-01"]);
  });

  it("spans a year boundary", () => {
    expect(monthsBetween("2025-11-20", "2026-02-03")).toEqual([
      "2026-02-01",
      "2026-01-01",
      "2025-12-01",
      "2025-11-01",
    ]);
  });

  it("anchors on the 1st, so no month can be clamped away", () => {
    // Walking back from the 31st is exactly the case that skips February.
    const months = monthsBetween("2026-01-31", "2026-03-31");
    expect(months).toEqual(["2026-03-01", "2026-02-01", "2026-01-01"]);
  });

  it("returns nothing for an inverted range instead of looping", () => {
    expect(monthsBetween("2026-08-01", "2026-05-01")).toEqual([]);
  });

  it("every anchor lands in a distinct month", () => {
    const months = monthsBetween("2024-01-15", "2026-07-15");
    expect(months).toHaveLength(31);
    expect(new Set(months).size).toBe(31);
    expect(months[0]).toBe("2026-07-01");
    expect(months.at(-1)).toBe("2024-01-01");
  });
});

describe("monthGrid minWeeks", () => {
  it("leaves the grid alone by default", () => {
    // The vertical stack wants each month exactly as tall as it is, and they
    // genuinely differ: February 2027 needs four rows, August 2026 needs six.
    expect(monthGrid("2027-02-15").cells).toHaveLength(28);
    expect(monthGrid("2026-02-15").cells).toHaveLength(35);
    expect(monthGrid("2026-08-15").cells).toHaveLength(42);
  });

  it("pads every month to the same height for the pager", () => {
    // A four-row month next to a six-row one makes a horizontal pager jump on
    // every swipe. Six is the maximum any month can need.
    for (const iso of [
      "2027-02-15", // 28 days starting Monday — the shortest grid there is
      "2026-02-15",
      "2026-08-15",
      "2026-11-15",
      "2024-02-15", // leap February
    ]) {
      expect(monthGrid(iso, { minWeeks: 6 }).cells).toHaveLength(42);
    }
  });

  it("pads only with nulls, never with dates", () => {
    const padded = monthGrid("2026-02-15", { minWeeks: 6 });
    const plain = monthGrid("2026-02-15");
    expect(padded.cells.filter((c) => c !== null)).toEqual(
      plain.cells.filter((c) => c !== null),
    );
  });

  it("clamps a nonsense minWeeks rather than growing without bound", () => {
    expect(monthGrid("2026-08-15", { minWeeks: 99 }).cells).toHaveLength(42);
    expect(monthGrid("2026-08-15", { minWeeks: -4 }).cells).toHaveLength(42);
    // A minWeeks smaller than the month needs can only ever be ignored — it
    // must never truncate real days out of the grid.
    expect(monthGrid("2026-02-15", { minWeeks: 1 }).cells).toHaveLength(35);
  });
});

describe("monthUptime", () => {
  const on = (dates: string[]): Entry[] =>
    dates.map((d) => ({ logged_for: d, lever: "gym", detail: null }));

  it("divides by the whole month by default", () => {
    expect(monthUptime(on(["2026-08-01", "2026-08-02"]), "2026-08-03")).toEqual({
      up: 2,
      total: 31,
      pct: 2 / 31,
    });
  });

  it("knows how long the month actually is", () => {
    expect(monthUptime([], "2026-02-15").total).toBe(28);
    expect(monthUptime([], "2024-02-15").total).toBe(29);
    expect(monthUptime([], "2026-04-15").total).toBe(30);
  });

  it("is zero, not NaN, on an empty history", () => {
    expect(monthUptime([], "2026-08-03")).toEqual({ up: 0, total: 31, pct: 0 });
  });

  it("reaches exactly 1 when every day of the month is up", () => {
    const august = Array.from(
      { length: 31 },
      (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`,
    );
    const full = monthUptime(on(august), "2026-08-31");
    expect(full.up).toBe(31);
    expect(full.pct).toBe(1);
  });

  it("ignores entries in neighbouring months", () => {
    const entries = on(["2026-07-31", "2026-08-02", "2026-09-01"]);
    expect(monthUptime(entries, "2026-08-15").up).toBe(1);
  });

  it("counts one day up once, however many levers fired", () => {
    const entries: Entry[] = [
      { logged_for: "2026-08-02", lever: "gym", detail: null },
      { logged_for: "2026-08-02", lever: "food", detail: null },
    ];
    expect(monthUptime(entries, "2026-08-03").up).toBe(1);
  });

  it("never counts a future day as up", () => {
    // A seeded or clock-skewed entry later this month must not light the wall
    // for a day that has not happened.
    const entries = on(["2026-08-01", "2026-08-20"]);
    expect(monthUptime(entries, "2026-08-03").up).toBe(1);
  });

  it("divides by the days so far under the elapsed basis", () => {
    // The same two days read 2/31 against the month and 2/3 against the month
    // so far — which is the whole difference between a wall that resets on the
    // 1st and one that does not.
    const entries = on(["2026-08-01", "2026-08-02"]);
    expect(monthUptime(entries, "2026-08-03", "elapsed")).toEqual({
      up: 2,
      total: 3,
      pct: 2 / 3,
    });
  });
});
