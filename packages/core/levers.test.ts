import { describe, expect, it } from "vitest";
import {
  DETAIL_MAX,
  LEVER_KEY_MAX,
  LEVER_LABEL_MAX,
  appendDetail,
  canAddLever,
  isValidLeverKey,
  slugifyLever,
  uniqueLeverKey,
  validateLeverLabel,
} from "./levers";
import { MAX_LEVERS } from "./grid";

describe("slugifyLever", () => {
  it("slugs an ordinary label", () => {
    expect(slugifyLever("Gym")).toBe("gym");
    expect(slugifyLever("No drink")).toBe("no-drink");
    expect(slugifyLever("  Reading  ")).toBe("reading");
  });

  it("collapses punctuation and runs of separators", () => {
    expect(slugifyLever("gym / food")).toBe("gym-food");
    expect(slugifyLever("10,000 steps")).toBe("10-000-steps");
  });

  it("keeps accented Latin readable rather than dropping letters", () => {
    expect(slugifyLever("café")).toBe("cafe");
    expect(slugifyLever("piscine à midi")).toBe("piscine-a-midi");
  });

  it("falls back rather than returning an empty key for non-Latin scripts", () => {
    // Not an edge case — this is every label in Cyrillic, Arabic, CJK, and the
    // product ships publicly. An empty key would be a broken lever.
    for (const label of ["спорт", "運動", "تمرين", "🏋️"]) {
      const key = slugifyLever(label);
      expect(key.length).toBeGreaterThan(0);
      expect(isValidLeverKey(key)).toBe(true);
    }
  });

  it("never produces an invalid key, whatever it is given", () => {
    for (const label of ["---", "  ", "!!!", "-a-", "a".repeat(200)]) {
      expect(isValidLeverKey(slugifyLever(label))).toBe(true);
    }
  });

  it("respects the key length cap without leaving a trailing hyphen", () => {
    const key = slugifyLever("a very long lever name that goes on and on and on");
    expect(key.length).toBeLessThanOrEqual(LEVER_KEY_MAX);
    expect(key.endsWith("-")).toBe(false);
  });
});

describe("uniqueLeverKey", () => {
  it("returns the plain slug when nothing collides", () => {
    expect(uniqueLeverKey("Gym", [])).toBe("gym");
  });

  it("suffixes on collision", () => {
    expect(uniqueLeverKey("Gym", ["gym"])).toBe("gym-2");
    expect(uniqueLeverKey("Gym", ["gym", "gym-2"])).toBe("gym-3");
  });

  it("disambiguates the non-Latin fallback, which collides by design", () => {
    expect(uniqueLeverKey("運動", ["lever"])).toBe("lever-2");
  });

  it("stays within the key cap even when suffixing", () => {
    const taken = [slugifyLever("x".repeat(40))];
    const key = uniqueLeverKey("x".repeat(40), taken);
    expect(key.length).toBeLessThanOrEqual(LEVER_KEY_MAX);
    expect(isValidLeverKey(key)).toBe(true);
  });
});

describe("validateLeverLabel", () => {
  it("accepts a normal label", () => {
    expect(validateLeverLabel("Gym").ok).toBe(true);
  });

  it("rejects empty and whitespace-only", () => {
    expect(validateLeverLabel("").ok).toBe(false);
    expect(validateLeverLabel("   ").ok).toBe(false);
  });

  it("rejects an over-long label", () => {
    expect(validateLeverLabel("a".repeat(LEVER_LABEL_MAX + 1)).ok).toBe(false);
  });

  it("explains how to fix it rather than just refusing", () => {
    const result = validateLeverLabel("a".repeat(LEVER_LABEL_MAX + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/characters/);
  });
});

describe("canAddLever", () => {
  it("allows up to the ceiling and no further", () => {
    expect(canAddLever(0)).toBe(true);
    expect(canAddLever(MAX_LEVERS - 1)).toBe(true);
    expect(canAddLever(MAX_LEVERS)).toBe(false);
    expect(canAddLever(MAX_LEVERS + 1)).toBe(false);
  });
});

describe("appendDetail", () => {
  it("keeps what was already recorded when adding to it", () => {
    // One entry per lever per day is a SCHEMA rule, not a product one. Doing
    // the thing twice is still one day up, and the record of what you did
    // should not lose the first half.
    expect(appendDetail("treadmill", "2 machines")).toBe("treadmill · 2 machines");
  });

  it("handles either side being absent", () => {
    expect(appendDetail(null, "shake")).toBe("shake");
    expect(appendDetail("shake", null)).toBe("shake");
    expect(appendDetail(null, null)).toBeNull();
    expect(appendDetail("", "  ")).toBeNull();
  });

  it("drops a repeat rather than recording it twice", () => {
    // Tapping the same playbook item twice in a day is a mis-tap, not two facts.
    expect(appendDetail("shake", "shake")).toBe("shake");
    expect(appendDetail("shake", "SHAKE")).toBe("shake");
    expect(appendDetail("a · b", "b")).toBe("a · b");
  });

  it("trims, and stays inside DETAIL_MAX", () => {
    expect(appendDetail("  a  ", "  b  ")).toBe("a · b");
    const long = appendDetail("x".repeat(200), "y");
    expect(long!.length).toBe(DETAIL_MAX);
  });

  it("never returns an empty string — null means nothing recorded", () => {
    expect(appendDetail("   ", null)).toBeNull();
  });
});
