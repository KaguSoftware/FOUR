import { describe, expect, it } from "vitest";
import {
  GLYPHS,
  GLYPH_H,
  GLYPH_W,
  glyphBit,
  glyphRows,
  normalizeMessage,
  textWidth,
} from "./font5x7";
import { MOTTO } from "./pixels";

describe("the glyph table", () => {
  it("parses every glyph to exactly 7 rows of 5 bits", () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, ch).toHaveLength(GLYPH_H);
      for (const row of rows) {
        expect(row, ch).toBeGreaterThanOrEqual(0);
        // 5 bits wide: anything above 0b11111 means a row overflowed.
        expect(row, ch).toBeLessThan(1 << GLYPH_W);
      }
    }
  });

  it("covers A-Z and 0-9", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
      expect(glyphRows(ch), ch).not.toBeNull();
    }
  });

  it("can draw the motto", () => {
    for (const ch of MOTTO.replace(/ /g, "")) {
      expect(glyphRows(ch), ch).not.toBeNull();
    }
  });

  it("has no blank letter", () => {
    // A glyph that parsed to all zeroes draws nothing, and the message would
    // silently lose a character with no other symptom.
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
      const rows = glyphRows(ch)!;
      expect(rows.some((r) => r !== 0), ch).toBe(true);
    }
  });

  it("returns null for a character it cannot draw, rather than a box", () => {
    // A tofu box in a stencil reads as a hole punched in the message.
    expect(glyphRows("€")).toBeNull();
    expect(glyphRows("字")).toBeNull();
  });

  it("is case-insensitive on lookup", () => {
    expect(glyphRows("k")).toEqual(glyphRows("K"));
  });

  it("reads bits left to right", () => {
    // "L" is a solid left column with a solid bottom row — the easiest glyph
    // to check by hand, and it catches a reversed bit order immediately.
    const L = glyphRows("L")!;
    expect(glyphBit(L, 0, 0)).toBe(true);
    expect(glyphBit(L, 4, 0)).toBe(false);
    expect(glyphBit(L, 4, GLYPH_H - 1)).toBe(true);
  });

  it("reads out of bounds as unset rather than throwing", () => {
    const A = glyphRows("A")!;
    expect(glyphBit(A, -1, 0)).toBe(false);
    expect(glyphBit(A, 99, 0)).toBe(false);
    expect(glyphBit(A, 0, 99)).toBe(false);
  });
});

describe("normalizeMessage", () => {
  it("upper-cases and collapses whitespace", () => {
    expect(normalizeMessage("  keep   going ")).toBe("KEEP GOING");
    expect(normalizeMessage("keep\ngoing")).toBe("KEEP GOING");
  });

  it("drops what the font cannot draw, never substitutes", () => {
    expect(normalizeMessage("keep € going")).toBe("KEEP GOING");
    expect(normalizeMessage("字字字")).toBe("");
  });

  it("does not leave a double space where a word was dropped", () => {
    expect(normalizeMessage("keep 字 going")).toBe("KEEP GOING");
  });

  it("keeps the punctuation it does have", () => {
    expect(normalizeMessage("keep going!")).toBe("KEEP GOING!");
  });
});

describe("textWidth", () => {
  it("is zero for nothing", () => {
    expect(textWidth("")).toBe(0);
  });

  it("counts one glyph as its own width", () => {
    expect(textWidth("A")).toBe(GLYPH_W);
  });

  it("adds a gap between letters but not after the last", () => {
    expect(textWidth("AB")).toBe(GLYPH_W * 2 + 1);
    expect(textWidth("ABC")).toBe(GLYPH_W * 3 + 2);
  });

  it("gives a space its own narrower width", () => {
    // Wide enough to read as a word break, narrower than a letter.
    expect(textWidth("A A")).toBe(GLYPH_W + 1 + 3 + 1 + GLYPH_W);
  });
});
