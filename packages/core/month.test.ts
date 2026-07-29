import { describe, expect, it } from "vitest";
import { monthGrid, WEEKDAY_INITIALS } from "./month";

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
});
