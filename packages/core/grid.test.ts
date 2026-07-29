import { describe, expect, it } from "vitest";
import { MAX_LEVERS, gridFill, gridRamp, leversOn } from "./grid";

const INK = "#eceff1";

const span = (created_on: string, archived_on: string | null = null) => ({
  created_on,
  archived_on,
});

describe("leversOn", () => {
  it("counts only levers that existed on the day", () => {
    const spans = [span("2026-01-01"), span("2026-06-01")];
    expect(leversOn(spans, "2026-03-15")).toBe(1);
    expect(leversOn(spans, "2026-06-15")).toBe(2);
  });

  it("keeps a past day's denominator when a lever is added later", () => {
    // The whole point. Two levers all through May; a third arrives in June.
    // May must still read as two, or every complete May day silently drops
    // from fully lit to two thirds because of a choice made in June.
    const before = [span("2026-01-01"), span("2026-01-01")];
    const after = [...before, span("2026-06-01")];
    expect(leversOn(before, "2026-05-20")).toBe(2);
    expect(leversOn(after, "2026-05-20")).toBe(2);
    expect(leversOn(after, "2026-06-20")).toBe(3);
  });

  it("still counts a lever on the days before it was archived", () => {
    const spans = [span("2026-01-01"), span("2026-01-01", "2026-06-10")];
    expect(leversOn(spans, "2026-05-01")).toBe(2);
    expect(leversOn(spans, "2026-07-01")).toBe(1);
  });

  it("includes both endpoints — the day it appeared and the day it went", () => {
    const spans = [span("2026-03-03", "2026-03-09")];
    expect(leversOn(spans, "2026-03-02")).toBe(1); // floor, not 0
    expect(leversOn(spans, "2026-03-03")).toBe(1);
    expect(leversOn(spans, "2026-03-09")).toBe(1);
    expect(leversOn(spans, "2026-03-10")).toBe(1); // floor again
  });

  it("never returns zero, so nothing downstream divides by it", () => {
    expect(leversOn([], "2026-05-01")).toBe(1);
    expect(leversOn([span("2027-01-01")], "2026-05-01")).toBe(1);
  });

  it("clamps to the four-lever ceiling", () => {
    const many = Array.from({ length: 9 }, () => span("2026-01-01"));
    expect(leversOn(many, "2026-05-01")).toBe(MAX_LEVERS);
  });
});

describe("gridRamp", () => {
  it("has exactly one step per lever", () => {
    for (let n = 1; n <= MAX_LEVERS; n++) {
      expect(gridRamp(n)).toHaveLength(n);
    }
  });

  it("always tops out at ink, so 'every lever' reads the same at any count", () => {
    for (let n = 1; n <= MAX_LEVERS; n++) {
      expect(gridRamp(n).at(-1)).toBe(INK);
    }
  });

  it("places each step in proportion to how many levers fired", () => {
    // The whole point of the ramp: two of three is two thirds of the way up,
    // not the midpoint. Half is half whichever count produces it.
    expect(gridRamp(2)[0]).toBe(gridRamp(4)[1]); // 1/2 === 2/4
    expect(gridRamp(4)[1]).toBe("#a5a8ab");
    expect(gridRamp(3)[1]).toBe("#bcbfc2"); // 2/3, above the halfway shade
    expect(gridRamp(3)[1] > gridRamp(2)[0]).toBe(true);
  });

  it("clamps out-of-range lever counts rather than throwing", () => {
    expect(gridRamp(0)).toEqual(gridRamp(1));
    expect(gridRamp(9)).toEqual(gridRamp(MAX_LEVERS));
    expect(gridRamp(NaN)).toEqual(gridRamp(1));
  });

  it("is monotonically lighter", () => {
    // Hex ordering works here because every step is a neutral of the same hue.
    for (let n = 2; n <= MAX_LEVERS; n++) {
      const ramp = gridRamp(n);
      for (let i = 1; i < ramp.length; i++) {
        expect(ramp[i] > ramp[i - 1]).toBe(true);
      }
    }
  });

  it("never puts a step at or below the 0.51 floor", () => {
    // Nothing renders AT the floor: zero levers is a down day, so the dimmest
    // step is 1/4 at L 0.62. That is what buys 4.83:1 against a down cell,
    // versus 3.07:1 when the dimmest step sat on the floor itself.
    const FLOOR = "#63666b"; // L 0.51, the old ramp's dimmest step
    for (let n = 1; n <= MAX_LEVERS; n++) {
      expect(gridRamp(n)[0] > FLOOR).toBe(true);
    }
  });
});

describe("gridFill", () => {
  it("returns null for a down day so the client draws its bordered cell", () => {
    expect(gridFill(0, 2)).toBeNull();
    expect(gridFill(-1, 2)).toBeNull();
  });

  it("puts every lever on ink", () => {
    expect(gridFill(1, 1)).toBe(INK);
    expect(gridFill(2, 2)).toBe(INK);
    expect(gridFill(4, 4)).toBe(INK);
  });

  it("scales with the fraction fired, not with the raw count", () => {
    // One of two and two of four are the same day, told two ways.
    expect(gridFill(1, 2)).toBe(gridFill(2, 4));
    // And more of the same levers is always brighter.
    expect(gridFill(2, 3)! > gridFill(1, 3)!).toBe(true);
    expect(gridFill(3, 4)! > gridFill(2, 4)!).toBe(true);
  });

  it("clamps rather than overflowing when more fired than are configured", () => {
    // Can happen momentarily after a lever is archived: the entry survives, the
    // lever count drops. It must render, not crash.
    expect(gridFill(4, 2)).toBe(INK);
    expect(gridFill(99, 3)).toBe(INK);
  });

  it("never returns the same fill for different step counts", () => {
    const ramp = gridRamp(4);
    expect(new Set(ramp).size).toBe(ramp.length);
  });

  it("keeps a lone lever's day brighter the fewer levers exist", () => {
    // Adding a lever genuinely re-scales past days — one of four is a smaller
    // share than one of two, and the grid says so. Up/down and every number
    // are untouched; only the shade moves.
    expect(gridFill(1, 2)! > gridFill(1, 3)!).toBe(true);
    expect(gridFill(1, 3)! > gridFill(1, 4)!).toBe(true);
  });
});
