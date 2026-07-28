import { describe, expect, it } from "vitest";
import { MAX_LEVERS, gridFill, gridRamp } from "./grid";

const INK = "#eceff1";
const FLOOR = "#63666b";

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

  it("always bottoms out at the 0.51 floor when there is more than one step", () => {
    for (let n = 2; n <= MAX_LEVERS; n++) {
      expect(gridRamp(n)[0]).toBe(FLOOR);
    }
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
});

describe("gridFill", () => {
  it("returns null for a down day so the client draws its bordered cell", () => {
    expect(gridFill(0, 2)).toBeNull();
    expect(gridFill(-1, 2)).toBeNull();
  });

  it("puts a single lever on the floor step", () => {
    expect(gridFill(1, 2)).toBe(FLOOR);
    expect(gridFill(1, 4)).toBe(FLOOR);
  });

  it("puts every lever on ink", () => {
    expect(gridFill(1, 1)).toBe(INK);
    expect(gridFill(2, 2)).toBe(INK);
    expect(gridFill(4, 4)).toBe(INK);
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

  it("keeps a one-lever day identical no matter how many levers exist", () => {
    // Adding a lever must not make a previously-logged day look emptier than
    // the floor. The floor is the floor at every count.
    const fills = [2, 3, 4].map((n) => gridFill(1, n));
    expect(new Set(fills).size).toBe(1);
  });
});
