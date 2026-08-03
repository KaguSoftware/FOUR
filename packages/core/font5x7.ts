/**
 * A 5×7 bitmap font, for drawing text out of grid cells.
 *
 * The pixel wall spells its message by leaving cells UNLIT, so the letters are
 * a stencil rather than type — which means no real font can draw them. At the
 * sizes involved (a glyph is five cells wide) there is no anti-aliasing and no
 * hinting to help, so every stroke has to be placed by hand.
 *
 * **Glyphs are written as pictures, not as hex.** `0b01110` and `#.###.` carry
 * the same information, but only one of them shows a typo in a code review, and
 * only one of them can be edited by someone who is not counting bits. They are
 * parsed to row bitmasks once at module load, so the readable form costs
 * nothing at draw time.
 *
 * The parser THROWS on a malformed glyph. A font with one bad row renders a
 * smeared letter, which looks like a bug in the layout code and is very hard to
 * trace back to here; failing at import means a bad edit fails `npm test`
 * instead of shipping.
 */

export const GLYPH_W = 5;
export const GLYPH_H = 7;

/**
 * Blank columns between letters, at scale 1. One is enough at this weight —
 * two reads as a word break.
 */
export const LETTER_GAP = 1;
/** A space character's own width. Wider than the letter gap, or it vanishes. */
export const SPACE_W = 3;
/** Blank rows between wrapped lines. */
export const LINE_GAP = 2;

const SOURCE: Record<string, string> = {
  A: `
.###.
#...#
#...#
#####
#...#
#...#
#...#`,
  B: `
####.
#...#
#...#
####.
#...#
#...#
####.`,
  C: `
.###.
#...#
#....
#....
#....
#...#
.###.`,
  D: `
####.
#...#
#...#
#...#
#...#
#...#
####.`,
  E: `
#####
#....
#....
####.
#....
#....
#####`,
  F: `
#####
#....
#....
####.
#....
#....
#....`,
  G: `
.###.
#...#
#....
#.###
#...#
#...#
.###.`,
  H: `
#...#
#...#
#...#
#####
#...#
#...#
#...#`,
  I: `
#####
..#..
..#..
..#..
..#..
..#..
#####`,
  J: `
..###
...#.
...#.
...#.
...#.
#..#.
.##..`,
  K: `
#...#
#..#.
#.#..
##...
#.#..
#..#.
#...#`,
  L: `
#....
#....
#....
#....
#....
#....
#####`,
  M: `
#...#
##.##
#.#.#
#.#.#
#...#
#...#
#...#`,
  N: `
#...#
##..#
#.#.#
#.#.#
#..##
#...#
#...#`,
  O: `
.###.
#...#
#...#
#...#
#...#
#...#
.###.`,
  P: `
####.
#...#
#...#
####.
#....
#....
#....`,
  Q: `
.###.
#...#
#...#
#...#
#.#.#
#..#.
.##.#`,
  R: `
####.
#...#
#...#
####.
#.#..
#..#.
#...#`,
  S: `
.####
#....
#....
.###.
....#
....#
####.`,
  T: `
#####
..#..
..#..
..#..
..#..
..#..
..#..`,
  U: `
#...#
#...#
#...#
#...#
#...#
#...#
.###.`,
  V: `
#...#
#...#
#...#
#...#
#...#
.#.#.
..#..`,
  W: `
#...#
#...#
#...#
#.#.#
#.#.#
##.##
#...#`,
  X: `
#...#
#...#
.#.#.
..#..
.#.#.
#...#
#...#`,
  Y: `
#...#
#...#
.#.#.
..#..
..#..
..#..
..#..`,
  Z: `
#####
....#
...#.
..#..
.#...
#....
#####`,
  "0": `
.###.
#...#
#..##
#.#.#
##..#
#...#
.###.`,
  "1": `
..#..
.##..
..#..
..#..
..#..
..#..
.###.`,
  "2": `
.###.
#...#
....#
...#.
..#..
.#...
#####`,
  "3": `
#####
...#.
..#..
...#.
....#
#...#
.###.`,
  "4": `
...#.
..##.
.#.#.
#..#.
#####
...#.
...#.`,
  "5": `
#####
#....
####.
....#
....#
#...#
.###.`,
  "6": `
..##.
.#...
#....
####.
#...#
#...#
.###.`,
  "7": `
#####
....#
...#.
..#..
.#...
.#...
.#...`,
  "8": `
.###.
#...#
#...#
.###.
#...#
#...#
.###.`,
  "9": `
.###.
#...#
#...#
.####
....#
...#.
.##..`,
  "!": `
..#..
..#..
..#..
..#..
..#..
.....
..#..`,
  "?": `
.###.
#...#
....#
...#.
..#..
.....
..#..`,
  ".": `
.....
.....
.....
.....
.....
.....
..#..`,
  ",": `
.....
.....
.....
.....
..#..
..#..
.#...`,
  "'": `
..#..
..#..
.....
.....
.....
.....
.....`,
  "-": `
.....
.....
.....
#####
.....
.....
.....`,
  ":": `
.....
..#..
..#..
.....
..#..
..#..
.....`,
};

/**
 * One glyph's rows as bitmasks, MSB = leftmost column.
 *
 * A row is a 5-bit number, so `0b11111` is a solid row and `0b00100` is a
 * single centred cell.
 */
function parse(ch: string, art: string): readonly number[] {
  const rows = art.split("\n").filter((line) => line.length > 0);

  if (rows.length !== GLYPH_H) {
    throw new Error(
      `font5x7: glyph "${ch}" has ${rows.length} rows, expected ${GLYPH_H}`,
    );
  }

  return rows.map((line, y) => {
    if (line.length !== GLYPH_W) {
      throw new Error(
        `font5x7: glyph "${ch}" row ${y} is ${line.length} wide, expected ${GLYPH_W}`,
      );
    }
    let bits = 0;
    for (let x = 0; x < GLYPH_W; x++) {
      const c = line[x];
      if (c !== "#" && c !== ".") {
        throw new Error(
          `font5x7: glyph "${ch}" row ${y} has "${c}"; only "#" and "." are allowed`,
        );
      }
      if (c === "#") bits |= 1 << (GLYPH_W - 1 - x);
    }
    return bits;
  });
}

export const GLYPHS: Readonly<Record<string, readonly number[]>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(SOURCE).map(([ch, art]) => [ch, parse(ch, art)]),
    ),
  );

/**
 * The rows for a character, or `null` if this font has no glyph for it.
 *
 * Callers DROP an unknown character rather than substituting a box. A tofu box
 * in a stencil reads as a hole punched in the message, which is worse than the
 * character simply not being there.
 */
export function glyphRows(ch: string): readonly number[] | null {
  return GLYPHS[ch.toUpperCase()] ?? null;
}

/**
 * Whether a cell is set in a glyph row.
 *
 * Bounds are checked explicitly rather than left to the shift: JavaScript
 * shifts by `n & 31`, so `1 << -95` is `1 << 1` and an x well off the right of
 * the glyph would come back SET — a stray cell in the stencil, in a place
 * nothing would ever look for it.
 */
export function glyphBit(rows: readonly number[], x: number, y: number): boolean {
  if (x < 0 || x >= GLYPH_W || y < 0 || y >= rows.length) return false;
  return (rows[y] & (1 << (GLYPH_W - 1 - x))) !== 0;
}

/**
 * Upper-case, collapse whitespace, and drop anything this font cannot draw.
 *
 * Uppercase because there are no lowercase glyphs — the product's whole label
 * vocabulary is lowercase-or-caps and a stencil at five cells wide has no room
 * for descenders anyway.
 */
export function normalizeMessage(s: string): string {
  return s
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
    .split("")
    .filter((ch) => ch === " " || GLYPHS[ch] !== undefined)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** How wide `text` draws at scale 1, in cells. */
export function textWidth(text: string): number {
  if (text.length === 0) return 0;
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += text[i] === " " ? SPACE_W : GLYPH_W;
    if (i < text.length - 1) w += LETTER_GAP;
  }
  return w;
}
