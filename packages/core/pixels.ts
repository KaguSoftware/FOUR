/**
 * The pixel wall.
 *
 * `/proof` used to be a chart. It answered "is this doing anything" with a
 * polyline of self-reported energy ratings, which is a question you have to
 * already care about to go and look at. This replaces it with something that
 * can be read in the half second it takes to land on the tab: a screen full of
 * cells, of which as many are lit as the fraction of this month you have been
 * up.
 *
 * **The message is made of the cells that never light.** A fixed set of them
 * is masked out in the shape of the letters, and the lit cells are the ground
 * AROUND those letters. So at 0% the wall is uniformly dark and there is
 * nothing to read; as it fills, the message emerges in negative. Someone who
 * has done half the month can read half of it.
 *
 * That inversion is the whole design, and it is why the encouragement here
 * cannot be dishonest: the app never tells you to keep going, it only
 * gradually stops hiding the fact that it would.
 *
 * Everything in this file is pure and deterministic. Both clients compute the
 * identical wall from the identical inputs and differ only in the primitive
 * they draw it with — same doctrine as the day-grid ramp and the mood face.
 */

import {
  GLYPH_H,
  GLYPH_W,
  LETTER_GAP,
  LINE_GAP,
  SPACE_W,
  glyphBit,
  glyphRows,
  normalizeMessage,
  textWidth,
} from "./font5x7";

/** What the wall says when nothing else is asked for. */
export const MOTTO = "KEEP GOING";

/**
 * The pool the monthly message is drawn from.
 *
 * Every word is at most five letters, and that is a hard rule, not taste: the
 * narrowest supported phone yields a 32-column wall, and a five-letter word at
 * scale 1 is 29 columns (see `GRID_TARGET`). A six-letter word is 35 and
 * silently degrades the message to its first words on exactly the screens
 * where it is hardest to read.
 *
 * The register is DESIGN.md's: flat, no praise, no scolding. The wall never
 * congratulates — it only stops hiding what it would say.
 */
export const MOTTOS: readonly string[] = [
  MOTTO,
  "STILL HERE",
  "ONE REAL THING",
  "DAY BY DAY",
  "BACK AGAIN",
  "IT ADDS UP",
  "SLOW IS FINE",
  "NO ZERO DAYS",
  "SHOW UP AGAIN",
  "THIS IS PROOF",
  "NOT DONE YET",
  "JUST TODAY",
  "ONE MORE DAY",
  "SMALL IS REAL",
  "UP IS UP",
  "STILL GOING",
];

/**
 * The message for the month containing `todayISO` (`YYYY-MM-DD`).
 *
 * Keyed on the calendar month and nothing else, so it is stable for the whole
 * month — a wall that changed its stencil mid-reveal would throw away the
 * half-emerged message someone had been earning — and both clients pick the
 * SAME one from the same date, which is the doctrine of this whole package.
 * The month index goes through an integer mix rather than a plain modulo so
 * consecutive months do not simply walk the list in order.
 */
export function monthMotto(todayISO: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(todayISO ?? "");
  if (!m) return MOTTO;
  const key = Number(m[1]) * 12 + (Number(m[2]) - 1);
  let h = Math.imul(key ^ 0x9e3779b9, 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  return MOTTOS[h % MOTTOS.length];
}

/**
 * - `mask` — part of a letter. NEVER lights, at any percentage.
 * - `lit` — ground that has been earned.
 * - `dark` — ground that has not.
 *
 * **`mask` and `dark` MUST render identically.** They are separate states
 * because the wall needs to know which is which, not because they look
 * different — if a client draws them even one step apart, the message is
 * legible at 0% and the entire idea collapses.
 */
export type PixelCell = "mask" | "lit" | "dark";

export type PixelWall = {
  cols: number;
  rows: number;
  /** Row-major, `cols * rows` long. */
  cells: readonly PixelCell[];
  /** Cells that can ever light: `cols * rows` minus the mask. */
  fillable: number;
  /** How many are lit at this percentage. */
  lit: number;
  /**
   * Per-cell luminosity, `cols * rows` long. `0` for anything unlit (mask and
   * dark alike); a lit cell carries `0..1` — dim at the reveal front, full
   * once the front has moved `GLOW_SPAN` columns past it. At 100% every lit
   * cell is `1`: a finished month is a solid wall, not one with a stale tide
   * mark down its right edge.
   */
  glow: readonly number[];
  /**
   * The text ACTUALLY painted, which on a small grid is shorter than what was
   * asked for, and `""` when nothing fit. Never assume it equals `message` —
   * `wallCaption` reads this so the announcement cannot claim a word the wall
   * does not contain.
   */
  shown: string;
  /** The integer glyph scale used, or 0 when no message was drawn. */
  scale: number;
};

export type WallOpts = {
  cols: number;
  rows: number;
  /** 0..1. Clamped; non-finite reads as 0. */
  pct: number;
  message?: string;
  /** Cells of clear ground kept around the message block. */
  margin?: number;
  /** How ragged the reveal front is, in columns. 0 is a hard vertical wipe. */
  bleed?: number;
};

const DEFAULT_MARGIN = 1;

/**
 * How many columns the reveal front is smeared across.
 *
 * Three, not one: on a forty-column wall a one-column front is still a
 * straight vertical line to the eye, and a straight line moving left to right
 * across a screen is a progress bar. Three columns of overlap reads as a tide
 * coming in.
 *
 * It is bounded by legibility in the other direction — the front's uncertainty
 * has to stay well under a letter's width (five columns) or the message stops
 * emerging cleanly a letter at a time.
 */
export const DEFAULT_BLEED = 3;

/**
 * How many columns of earned ground it takes to reach full brightness behind
 * the reveal front.
 *
 * The freshest cells glow faintly and brighten as the front moves on, so the
 * frontier reads as a tide coming in rather than a hard-edged fill. Wider than
 * the bleed on purpose: the bleed roughens the front's SHAPE, this fades its
 * LIGHT, and at three columns each the two would cancel into mush. Bounded
 * above by honesty — ground earned more than a week ago should simply be lit,
 * not still visibly "newer" than the rest.
 */
export const GLOW_SPAN = 8;
/** No calendar month needs more than six rows of glyphs; more is unreadable. */
const MAX_LINES = 3;

/**
 * A stable 0..1 from a pair of integers.
 *
 * **Not `Math.random`.** The wall must be byte-identical on both clients and
 * across every re-render — a wall that reshuffles when the screen redraws is a
 * flicker, and one that differs between phone and browser is two answers to
 * the same question. This is a plain integer mix, so the same cell always gets
 * the same jitter.
 */
function hash01(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

type Line = { text: string; width: number };

/** Greedy word wrap at `maxWidth` cells (scale 1). Null if a word cannot fit. */
function wrap(message: string, maxWidth: number): Line[] | null {
  const words = message.split(" ").filter(Boolean);
  if (words.length === 0) return [];

  const lines: Line[] = [];
  let current = "";

  for (const word of words) {
    if (textWidth(word) > maxWidth) return null;
    const candidate = current === "" ? word : `${current} ${word}`;
    if (textWidth(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push({ text: current, width: textWidth(current) });
      current = word;
    }
  }
  lines.push({ text: current, width: textWidth(current) });

  return lines.length <= MAX_LINES ? lines : null;
}

type Block = { lines: Line[]; scale: number; width: number; height: number };

/** The largest scale at which `message` fits the box, or null. */
function fit(message: string, boxW: number, boxH: number): Block | null {
  const maxScale = Math.min(
    Math.floor(boxW / GLYPH_W),
    Math.floor(boxH / GLYPH_H),
  );

  for (let scale = maxScale; scale >= 1; scale--) {
    const lines = wrap(message, Math.floor(boxW / scale));
    if (lines === null || lines.length === 0) continue;

    const width = Math.max(...lines.map((l) => l.width)) * scale;
    const height =
      (lines.length * GLYPH_H + (lines.length - 1) * LINE_GAP) * scale;

    if (width <= boxW && height <= boxH) return { lines, scale, width, height };
  }
  return null;
}

/** Every word of `message` from the start that fits, longest first. */
function fitTruncated(message: string, boxW: number, boxH: number): Block | null {
  const words = message.split(" ").filter(Boolean);
  for (let n = words.length; n >= 1; n--) {
    const block = fit(words.slice(0, n).join(" "), boxW, boxH);
    if (block) return block;
  }
  return null;
}

/**
 * The wall for a grid and a percentage.
 *
 * Layout: pick the largest integer glyph scale that fits inside the margins,
 * word-wrapping greedily; centre the block; paint its set cells as `mask`.
 * An integer scale — never fractional — because a stencil at 1.4× has rows
 * that are one cell tall next to rows that are two, and reads as a damaged
 * letter rather than a bigger one.
 *
 * If nothing fits even at scale 1 with no margin, the wall carries NO mask at
 * all. A wall with no message is a valid wall; a clipped half-letter is not.
 *
 * Fill order is `x + bleed * hash01(x, y)`, which is column-major with a
 * deterministic jitter. Strictly column-major gives a hard vertical edge, and a
 * hard edge reads as a loading bar — *you are 40% done and 60% missing* — which
 * is the same remainder-as-a-hole reading the day grid's No-Subdivision Rule
 * exists to forbid. The jitter dissolves the front instead, while keeping the
 * left-to-right guarantee that makes the message legible a word at a time.
 */
export function pixelWall(opts: WallOpts): PixelWall {
  const cols = clampDim(opts.cols);
  const rows = clampDim(opts.rows);
  const total = cols * rows;

  const pct = Number.isFinite(opts.pct)
    ? Math.min(Math.max(opts.pct, 0), 1)
    : 0;

  if (total === 0) {
    return {
      cols,
      rows,
      cells: [],
      fillable: 0,
      lit: 0,
      glow: [],
      shown: "",
      scale: 0,
    };
  }

  const message = normalizeMessage(opts.message ?? MOTTO);
  const margin = Math.max(Math.trunc(opts.margin ?? DEFAULT_MARGIN), 0);
  const bleed = Math.max(opts.bleed ?? DEFAULT_BLEED, 0);

  const cells: PixelCell[] = new Array(total).fill("dark");

  // Try inside the margins first, then flush to the edges rather than giving
  // up — a small grid would rather have a tight message than none.
  let block: Block | null = null;
  let used = margin;
  if (message.length > 0) {
    for (const m of margin > 0 ? [margin, 0] : [0]) {
      const boxW = cols - 2 * m;
      const boxH = rows - 2 * m;
      if (boxW <= 0 || boxH <= 0) continue;
      block = fit(message, boxW, boxH) ?? fitTruncated(message, boxW, boxH);
      if (block) {
        used = m;
        break;
      }
    }
  }

  let shown = "";
  if (block) {
    shown = block.lines.map((l) => l.text).join(" ");
    paint(cells, cols, rows, block, used);
  }

  const fillable = total - cells.reduce((n, c) => n + (c === "mask" ? 1 : 0), 0);

  // The endpoints are special-cased rather than left to rounding: a wall at
  // 100% that leaves one cell dark reads as a rendering fault, and one at 0%
  // that lights a single cell puts a hole in an otherwise blank screen.
  const lit =
    pct <= 0 ? 0 : pct >= 1 ? fillable : Math.min(Math.round(pct * fillable), fillable);

  const glow: number[] = new Array(total).fill(0);
  if (lit > 0) {
    const order: { i: number; rank: number }[] = [];
    for (let i = 0; i < total; i++) {
      if (cells[i] === "mask") continue;
      const x = i % cols;
      const y = (i / cols) | 0;
      order.push({ i, rank: x + bleed * hash01(x, y) });
    }
    // Index as the final tie-break, so the order is total and two identical
    // calls cannot come out differently.
    order.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.i - b.i));

    // The front's own rank, which the fade is measured back from. At 100%
    // there is no front, so everything is simply lit at full.
    const front = order[lit - 1].rank;
    for (let n = 0; n < lit; n++) {
      cells[order[n].i] = "lit";
      glow[order[n].i] =
        pct >= 1 ? 1 : Math.min((front - order[n].rank) / GLOW_SPAN, 1);
    }
  }

  return {
    cols,
    rows,
    cells,
    fillable,
    lit,
    glow,
    shown,
    scale: block?.scale ?? 0,
  };
}

function clampDim(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.trunc(n);
}

/** Stamp the block's set cells into `cells` as `mask`, centred. */
function paint(
  cells: PixelCell[],
  cols: number,
  rows: number,
  block: Block,
  margin: number,
): void {
  const { lines, scale } = block;
  const originY = margin + Math.floor((rows - 2 * margin - block.height) / 2);

  lines.forEach((line, lineIndex) => {
    const lineY = originY + lineIndex * (GLYPH_H + LINE_GAP) * scale;
    // Each line centred within the block, not left-aligned to it — a short
    // second line hanging off the left edge reads as a layout fault.
    let cursorX =
      margin + Math.floor((cols - 2 * margin - line.width * scale) / 2);

    for (const ch of line.text) {
      if (ch === " ") {
        cursorX += (SPACE_W + LETTER_GAP) * scale;
        continue;
      }
      const glyph = glyphRows(ch);
      if (glyph) {
        for (let gy = 0; gy < GLYPH_H; gy++) {
          for (let gx = 0; gx < GLYPH_W; gx++) {
            if (!glyphBit(glyph, gx, gy)) continue;
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                const x = cursorX + gx * scale + sx;
                const y = lineY + gy * scale + sy;
                if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
                cells[y * cols + x] = "mask";
              }
            }
          }
        }
      }
      cursorX += (GLYPH_W + LETTER_GAP) * scale;
    }
  });
}

export type WallGrid = { cols: number; rows: number; cell: number; gap: number };

/**
 * The default cell size, and it is NOT a taste decision.
 *
 * The widest word in the motto is `GOING`, which at scale 1 is five glyphs of
 * five cells plus four letter gaps — **29 columns**, before any margin. A wall
 * with fewer columns than that cannot draw the word at all: it degrades to
 * `KEEP` alone, or to nothing.
 *
 * So the cell size follows from the narrowest screen the app supports. At 8dp
 * cells and a 2dp gap, a 320pt phone yields 32 columns and a 390pt one yields
 * 39 — both comfortably clear of 29, with margin to spare. A 14dp cell, which
 * is what the day grid uses, gives 23 columns and silently loses half the
 * message. Do not raise this without recomputing that.
 *
 * The happy side effect is that it is also what makes the screen read as
 * *pixels* rather than as tiles: ~2,500 of them on a phone.
 */
const GRID_TARGET = 8;
const GRID_GAP = 2;

/**
 * How many cells fit a measured box.
 *
 * **Both clients call this.** Neither divides its own viewport: the wall's
 * layout depends on the integer `cols` and `rows`, so a client that rounded
 * differently would draw a different message from the same data.
 *
 * Columns come from the target cell size; the cell size is then recomputed to
 * fill the width EXACTLY, and the rows follow from that square cell. Sizing
 * off the width rather than the height is deliberate — the message reads
 * horizontally, so the horizontal resolution is the one that decides whether
 * it is legible.
 */
export function wallGrid(opts: {
  width: number;
  height: number;
  target?: number;
  gap?: number;
  maxCols?: number;
  maxRows?: number;
}): WallGrid {
  const gap = Math.max(opts.gap ?? GRID_GAP, 0);
  const target = Math.max(opts.target ?? GRID_TARGET, 1);
  const maxCols = Math.max(Math.trunc(opts.maxCols ?? 96), 1);
  const maxRows = Math.max(Math.trunc(opts.maxRows ?? 160), 1);

  const width = Number.isFinite(opts.width) ? Math.max(opts.width, 0) : 0;
  const height = Number.isFinite(opts.height) ? Math.max(opts.height, 0) : 0;

  const cols = Math.min(
    Math.max(Math.floor((width + gap) / (target + gap)), 1),
    maxCols,
  );
  const cell = cols > 0 ? (width - gap * (cols - 1)) / cols : 0;
  const rows = Math.min(
    Math.max(Math.floor((height + gap) / (cell + gap)), 1),
    maxRows,
  );

  return { cols, rows, cell: Math.max(cell, 0), gap };
}

/**
 * The lit layer's brightness steps, dimmest first.
 *
 * Four, not a per-cell opacity: the point of `pixelPaths` is a handful of
 * path nodes instead of thousands, and four bands are indistinguishable from
 * a continuous fade at 8dp cells. The floor is 0.35 — the freshest cells must
 * still read as LIT against the ground, or the earned area looks smaller than
 * the number in the corner says.
 */
export const GLOW_OPACITY: readonly number[] = [0.35, 0.55, 0.75, 1];

export type LitBand = { d: string; opacity: number };

/**
 * The layers as SVG path data.
 *
 * One path for every unlit cell and a handful for the lit ones, so a wall of
 * a thousand cells is a few nodes rather than a thousand — which is the
 * difference between a screen that mounts instantly and one that stutters on
 * an older phone. Same doctrine as `trendPath`: the SHAPE is computed here and
 * each client hands it to its own primitive.
 *
 * `lit` splits into `GLOW_OPACITY.length` bands by the wall's per-cell glow —
 * the tide fading in behind the reveal front. The OPACITY comes from core too,
 * so the two clients cannot disagree about what half-earned looks like.
 *
 * `ground` covers `mask` AND `dark` together, because they are the same colour
 * — see `PixelCell`. Nothing downstream should be able to tell them apart.
 */
export function pixelPaths(
  wall: PixelWall,
  box: { cell: number; gap: number },
): { lit: readonly LitBand[]; ground: string } {
  const cell = Math.max(box.cell, 0);
  const gap = Math.max(box.gap, 0);
  const bands: string[][] = GLOW_OPACITY.map(() => []);
  const ground: string[] = [];

  for (let i = 0; i < wall.cells.length; i++) {
    const x = round((i % wall.cols) * (cell + gap));
    const y = round(((i / wall.cols) | 0) * (cell + gap));
    const s = round(cell);
    const rect = `M${x} ${y}h${s}v${s}h${-s}Z`;
    if (wall.cells[i] === "lit") {
      const band = Math.min(
        Math.floor((wall.glow[i] ?? 1) * GLOW_OPACITY.length),
        GLOW_OPACITY.length - 1,
      );
      bands[band].push(rect);
    } else {
      ground.push(rect);
    }
  }

  return {
    lit: bands
      .map((d, b) => ({ d: d.join(""), opacity: GLOW_OPACITY[b] }))
      .filter((band) => band.d !== ""),
    ground: ground.join(""),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The one sentence a screen reader gets.
 *
 * The wall is unreadable to anything that is not looking at it, so this is not
 * a supplement to the visual — it IS the screen. It reads the wall's `shown`
 * rather than the requested message, so it can never announce a word that was
 * truncated off the grid.
 */
export function wallCaption(
  wall: Pick<PixelWall, "shown">,
  up: number,
  total: number,
): string {
  const pct = total > 0 ? Math.round((up / total) * 100) : 0;
  const figure = `${up} of ${total} days up this month — ${pct} percent.`;
  return wall.shown ? `${figure} The wall reads: ${wall.shown}.` : figure;
}
