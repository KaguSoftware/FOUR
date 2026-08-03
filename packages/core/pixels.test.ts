import { describe, expect, it } from "vitest";
import {
  DEFAULT_BLEED,
  MOTTO,
  pixelPaths,
  pixelWall,
  wallCaption,
  wallGrid,
  type PixelWall,
} from "./pixels";

/** A phone-shaped wall — what `wallGrid` produces for a 390×700pt screen. */
const wall = (pct: number, over: Partial<Parameters<typeof pixelWall>[0]> = {}) =>
  pixelWall({ cols: 39, rows: 70, pct, ...over });

const maskIndices = (w: PixelWall) =>
  new Set(w.cells.flatMap((c, i) => (c === "mask" ? [i] : [])));
const litIndices = (w: PixelWall) =>
  new Set(w.cells.flatMap((c, i) => (c === "lit" ? [i] : [])));

const PCTS = [0, 0.01, 0.13, 0.25, 0.5, 0.68, 0.87, 0.999, 1];

/**
 * The most lit/dark alternations found in any single column.
 *
 * This is what separates a dissolve from a wipe. A hard wipe still has ONE
 * partly-filled column, but its lit cells are contiguous — a clean horizontal
 * split, one transition. A dissolve scatters them, so some column alternates
 * many times.
 */
function maxAlternations(w: PixelWall): number {
  let worst = 0;
  for (let x = 0; x < w.cols; x++) {
    let n = 0;
    let prev: string | null = null;
    for (let y = 0; y < w.rows; y++) {
      const c = w.cells[y * w.cols + x];
      if (c === "mask") continue; // never lights; not part of the front
      if (prev !== null && c !== prev) n++;
      prev = c;
    }
    worst = Math.max(worst, n);
  }
  return worst;
}

describe("the mask", () => {
  it("never lights, at any percentage", () => {
    // The whole design rests on this. One lit mask cell and the letters
    // dissolve into the ground.
    for (const pct of PCTS) {
      const w = wall(pct);
      for (const i of maskIndices(w)) {
        expect(w.cells[i], `pct ${pct}, cell ${i}`).toBe("mask");
      }
    }
  });

  it("is the same set of cells at every percentage", () => {
    // The message is a stencil, not something that grows. If the mask moved,
    // the letters would appear to warp as the month went on.
    const base = maskIndices(wall(0));
    expect(base.size).toBeGreaterThan(0);
    for (const pct of PCTS) {
      expect([...maskIndices(wall(pct))]).toEqual([...base]);
    }
  });

  it("is left as ground when no message fits", () => {
    // A wall with no message is valid. A clipped half-letter is not.
    const tiny = pixelWall({ cols: 3, rows: 3, pct: 1 });
    expect(tiny.shown).toBe("");
    expect(tiny.scale).toBe(0);
    expect(maskIndices(tiny).size).toBe(0);
    expect(tiny.fillable).toBe(9);
  });
});

describe("filling", () => {
  it("lights nothing at zero", () => {
    const w = wall(0);
    expect(w.lit).toBe(0);
    expect(litIndices(w).size).toBe(0);
  });

  it("lights every non-mask cell at one", () => {
    const w = wall(1);
    expect(w.lit).toBe(w.fillable);
    expect(litIndices(w).size).toBe(w.fillable);
    expect(w.cells.filter((c) => c === "dark")).toHaveLength(0);
  });

  it("hits the endpoints exactly rather than by rounding", () => {
    // 0.999 must NOT round to a full wall, and 1 must not leave one cell dark
    // — a single stray cell at either end reads as a rendering fault.
    const nearly = wall(0.999);
    expect(nearly.lit).toBeLessThan(nearly.fillable);
    expect(wall(1).lit).toBe(wall(1).fillable);
  });

  it("lights the requested share in between", () => {
    const w = wall(0.5);
    expect(w.lit).toBe(Math.round(0.5 * w.fillable));
  });

  it("clamps a percentage outside 0..1", () => {
    expect(wall(-1).lit).toBe(0);
    expect(wall(2).lit).toBe(wall(1).fillable);
  });

  it("reads a non-finite percentage as empty, never as full", () => {
    // A division by zero upstream must darken the wall, not falsely complete
    // it — a full wall is a claim about the month, and the wall must never
    // make one it cannot support.
    expect(wall(NaN).lit).toBe(0);
    expect(wall(Infinity).lit).toBe(0);
  });
});

describe("the reveal", () => {
  it("only ever adds cells as the month goes on", () => {
    // Monotone containment. One more day up must light more of the wall and
    // never rearrange what is already there — a wall that reshuffles overnight
    // is indistinguishable from a bug.
    let prev = litIndices(wall(0));
    for (const pct of PCTS.slice(1)) {
      const next = litIndices(wall(pct));
      for (const i of prev) expect(next.has(i), `${pct} dropped ${i}`).toBe(true);
      prev = next;
    }
  });

  it("runs left to right, so the message reads a word at a time", () => {
    // The guarantee: a lit cell means every non-mask cell well to its left is
    // lit too. The slack is the jitter that softens the front, and it is read
    // from the real default rather than restated here — a wider bleed must
    // widen the slack, not quietly break the guarantee.
    const slack = Math.ceil(DEFAULT_BLEED) + 1;
    for (const pct of [0.2, 0.5, 0.8]) {
      const w = wall(pct);
      let frontier = 0;
      for (let i = 0; i < w.cells.length; i++) {
        if (w.cells[i] === "lit") frontier = Math.max(frontier, i % w.cols);
      }
      for (let i = 0; i < w.cells.length; i++) {
        if (w.cells[i] !== "dark") continue;
        expect(i % w.cols, `pct ${pct}`).toBeGreaterThan(frontier - slack - 1);
      }
    }
  });

  it("dissolves rather than wiping, so it does not read as a progress bar", () => {
    // A hard vertical edge draws the remainder as a hole, which is the exact
    // reading the day grid's No-Subdivision Rule forbids.
    for (const pct of [0.3, 0.5, 0.7]) {
      expect(maxAlternations(wall(pct)), `pct ${pct}`).toBeGreaterThan(4);
    }
  });

  it("is a hard wipe when bleed is zero", () => {
    // The control case, proving the measure above means what it says: with no
    // jitter every column is uniform except the one the front is crossing, and
    // that one splits exactly once.
    for (const pct of [0.3, 0.5, 0.7]) {
      expect(maxAlternations(wall(pct, { bleed: 0 })), `pct ${pct}`).toBe(1);
    }
  });
});

describe("layout", () => {
  it("centres the message", () => {
    const w = wall(0);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const i of maskIndices(w)) {
      xs.push(i % w.cols);
      ys.push((i / w.cols) | 0);
    }
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    expect(Math.abs(midX - (w.cols - 1) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(midY - (w.rows - 1) / 2)).toBeLessThanOrEqual(1);
  });

  it("keeps the message off the edges when there is a margin", () => {
    const w = wall(0);
    for (const i of maskIndices(w)) {
      const x = i % w.cols;
      const y = (i / w.cols) | 0;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(w.cols - 1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(w.rows - 1);
    }
  });

  it("scales the glyphs up when there is room", () => {
    const big = pixelWall({ cols: 80, rows: 60, pct: 0 });
    expect(big.scale).toBeGreaterThanOrEqual(2);
    expect(big.shown).toBe(MOTTO);
  });

  it("wraps when the whole motto will not fit on one line", () => {
    // 57 cells for "KEEP GOING" against a 39-column phone, so the real device
    // case is two lines. Seven rows tall each, so the mask must span more.
    const w = wall(0);
    expect(w.shown).toBe(MOTTO);
    const ys = [...maskIndices(w)].map((i) => (i / w.cols) | 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(7);
  });

  it("reports truncation rather than silently dropping a word", () => {
    // 26 columns has room for "KEEP" (23 cells) but not "GOING" (29), and 11
    // rows has room for one line but not two. `wallCaption` reads `shown`, so
    // the announcement can never claim a word the wall does not contain.
    const narrow = pixelWall({ cols: 26, rows: 11, pct: 0 });
    expect(narrow.shown).toBe("KEEP");
    expect(narrow.shown).not.toBe(MOTTO);
  });

  it("draws the motto whole on every screen the app supports", () => {
    // The constraint behind GRID_TARGET: "GOING" is 29 cells wide, so a wall
    // narrower than that loses half the message. This is the regression test
    // for raising the default cell size.
    for (const [w, h] of [
      [320, 568], // the smallest phone still in support
      [390, 844],
      [430, 932],
      [448, 900], // the web column at its max-width
    ]) {
      const g = wallGrid({ width: w, height: h });
      const built = pixelWall({ cols: g.cols, rows: g.rows, pct: 0 });
      expect(built.shown, `${w}x${h} → ${g.cols} cols`).toBe(MOTTO);
    }
  });

  it("draws a custom message", () => {
    const w = pixelWall({ cols: 40, rows: 30, pct: 0, message: "still here" });
    expect(w.shown).toBe("STILL HERE");
  });
});

describe("degenerate grids", () => {
  it("never throws", () => {
    for (const [cols, rows] of [
      [0, 0],
      [1, 1],
      [3, 3],
      [5, 7],
      [-4, 10],
      [10, -4],
      [NaN, 10],
      [10, NaN],
      [1, 500],
    ]) {
      expect(() => pixelWall({ cols, rows, pct: 0.5 })).not.toThrow();
    }
  });

  it("returns an empty wall for an empty grid", () => {
    const w = pixelWall({ cols: 0, rows: 0, pct: 1 });
    expect(w.cells).toEqual([]);
    expect(w.fillable).toBe(0);
    expect(w.lit).toBe(0);
  });

  it("keeps cells the length the dimensions claim", () => {
    for (const [cols, rows] of [[1, 1], [3, 3], [26, 48], [7, 9]]) {
      const w = pixelWall({ cols, rows, pct: 0.4 });
      expect(w.cells).toHaveLength(w.cols * w.rows);
    }
  });

  it("fills a grid too small for any message end to end", () => {
    const w = pixelWall({ cols: 2, rows: 2, pct: 1 });
    expect(w.fillable).toBe(4);
    expect(w.lit).toBe(4);
  });
});

describe("determinism", () => {
  it("gives byte-identical walls for identical inputs", () => {
    // Both clients compute this independently. If it used Math.random they
    // would disagree, and a single client would flicker on every re-render.
    for (const pct of PCTS) {
      expect(wall(pct)).toEqual(wall(pct));
    }
  });
});

describe("wallGrid", () => {
  it("fits whole cells across the width", () => {
    const g = wallGrid({ width: 448, height: 800, target: 14, gap: 3 });
    expect(g.cols * g.cell + (g.cols - 1) * g.gap).toBeCloseTo(448, 5);
  });

  it("makes cells square, so rows follow from the column count", () => {
    const g = wallGrid({ width: 390, height: 700 });
    const spanned = g.rows * g.cell + (g.rows - 1) * g.gap;
    expect(spanned).toBeLessThanOrEqual(700 + 0.001);
    expect(spanned + g.cell + g.gap).toBeGreaterThan(700);
  });

  it("never goes below one cell", () => {
    expect(wallGrid({ width: 0, height: 0 })).toMatchObject({ cols: 1, rows: 1 });
    expect(wallGrid({ width: 2, height: 2 })).toMatchObject({ cols: 1, rows: 1 });
  });

  it("survives an unmeasured box", () => {
    // A ResizeObserver's first frame and an onLayout before mount both give
    // these. They must not produce NaN dimensions downstream.
    const g = wallGrid({ width: NaN, height: NaN });
    expect(Number.isFinite(g.cell)).toBe(true);
    expect(g.cols).toBe(1);
  });

  it("respects the caps on a very large surface", () => {
    const g = wallGrid({ width: 6000, height: 9000, maxCols: 40, maxRows: 50 });
    expect(g.cols).toBe(40);
    expect(g.rows).toBe(50);
  });
});

describe("pixelPaths", () => {
  it("emits one subpath per cell, split by state", () => {
    const w = wall(0.5);
    const { lit, ground } = pixelPaths(w, { cell: 10, gap: 2 });
    expect((lit.match(/M/g) ?? []).length).toBe(w.lit);
    expect((ground.match(/M/g) ?? []).length).toBe(w.cells.length - w.lit);
  });

  it("groups mask and dark together — they are the same colour", () => {
    // If a client could tell them apart it would draw them apart, and the
    // message would be readable at 0%.
    const w = wall(0);
    const { lit, ground } = pixelPaths(w, { cell: 10, gap: 2 });
    expect(lit).toBe("");
    expect((ground.match(/M/g) ?? []).length).toBe(w.cells.length);
  });

  it("keeps every cell inside the box it claims", () => {
    const w = wall(1);
    const { lit } = pixelPaths(w, { cell: 10, gap: 2 });
    const maxX = w.cols * (10 + 2);
    for (const [, x, y] of lit.matchAll(/M([\d.]+) ([\d.]+)h/g)) {
      expect(Number(x)).toBeLessThanOrEqual(maxX);
      expect(Number(y)).toBeGreaterThanOrEqual(0);
    }
  });

  it("draws nothing for an empty wall", () => {
    const empty = pixelWall({ cols: 0, rows: 0, pct: 1 });
    expect(pixelPaths(empty, { cell: 10, gap: 2 })).toEqual({
      lit: "",
      ground: "",
    });
  });
});

describe("wallCaption", () => {
  it("states the figure and the message", () => {
    const caption = wallCaption({ shown: "KEEP GOING" }, 27, 31);
    expect(caption).toContain("27 of 31");
    expect(caption).toContain("87 percent");
    expect(caption).toContain("KEEP GOING");
  });

  it("never claims a word the wall does not contain", () => {
    const caption = wallCaption({ shown: "KEEP" }, 27, 31);
    expect(caption).toContain("KEEP");
    expect(caption).not.toContain("GOING");
  });

  it("drops the message clause when there is no message", () => {
    const caption = wallCaption({ shown: "" }, 0, 31);
    expect(caption).toContain("0 percent");
    expect(caption).not.toContain("reads");
  });

  it("does not divide by zero", () => {
    expect(wallCaption({ shown: "" }, 0, 0)).toContain("0 percent");
  });
});
