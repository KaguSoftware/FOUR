import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSTURE,
  POSTURES,
  POSTURE_CHOICES,
  POSTURE_FOOTNOTE,
  isPosture,
  milestonePanel,
  takeoverNote,
  takeoverPrompt,
  toPosture,
} from "./posture";
import { MILESTONE_COPY, RUN_MILESTONES, UPTIME_MILESTONES } from "./monitor";

describe("posture", () => {
  it("defaults to strict", () => {
    expect(DEFAULT_POSTURE).toBe("strict");
  });

  it("coerces anything unrecognised to the default rather than throwing", () => {
    // A database column, a stale client, a hand-posted form field.
    expect(toPosture("soft")).toBe("soft");
    expect(toPosture("gentle")).toBe("strict");
    expect(toPosture(null)).toBe("strict");
    expect(toPosture(undefined)).toBe("strict");
    expect(isPosture("SOFT")).toBe(false);
  });

  it("offers exactly the two postures, each with what actually changes", () => {
    expect(POSTURE_CHOICES.map((c) => c.value)).toEqual([...POSTURES]);
    for (const choice of POSTURE_CHOICES) {
      expect(choice.detail.length).toBeGreaterThan(20);
    }
  });
});

describe("the takeover", () => {
  it("adds nothing at all in strict", () => {
    // Null, not an empty string: a blank line would shift the layout between
    // postures, which is a difference the facts are not allowed to have.
    expect(takeoverNote("strict", { down: 4, hasLastRun: true })).toBeNull();
  });

  it("adds one sentence in soft, naming the break as ordinary", () => {
    const note = takeoverNote("soft", { down: 4, hasLastRun: true });
    expect(note).toBe(
      "Four days is an outage, not a failure. The run you already have doesn't go anywhere.",
    );
  });

  it("never points at a run that does not exist", () => {
    const note = takeoverNote("soft", { down: 4, hasLastRun: false });
    expect(note).toBe("Four days is an outage, not a failure.");
  });

  it("spells the day count past the word list rather than breaking", () => {
    expect(takeoverNote("soft", { down: 40, hasLastRun: false })).toBe(
      "40 days is an outage, not a failure.",
    );
  });

  it("labels the options differently, and that is the whole difference", () => {
    expect(takeoverPrompt("strict")).not.toBe(takeoverPrompt("soft"));
  });
});

describe("milestones", () => {
  it("says nothing extra in strict — a milestone reads like an alert", () => {
    for (const kind of Object.keys(MILESTONE_COPY)) {
      expect(milestonePanel("strict", kind)).toBeNull();
    }
  });

  it("acknowledges every real milestone in soft", () => {
    for (const kind of Object.keys(MILESTONE_COPY)) {
      const panel = milestonePanel("soft", kind);
      expect(panel, kind).not.toBeNull();
      expect(panel!.title.length).toBeGreaterThan(0);
      expect(panel!.note.length).toBeGreaterThan(0);
    }
  });

  it("reports the same threshold the flat copy reports", () => {
    for (const d of RUN_MILESTONES) {
      expect(milestonePanel("soft", `run_${d}`)!.title).toContain(String(d));
    }
    for (const p of UPTIME_MILESTONES) {
      expect(milestonePanel("soft", `uptime_${p}`)!.title).toContain(String(p));
    }
  });

  it("ignores a kind it does not recognise", () => {
    expect(milestonePanel("soft", "coins_500")).toBeNull();
  });
});

/**
 * The guard that keeps SOFT from drifting into the category this product
 * rejects. Softer means warmer words and permission to acknowledge a
 * milestone — never a score, a badge, or a thing to farm.
 *
 * Scanning the copy is a blunt check, and that is why it works: the first
 * person to write "streak" or "reward" into a posture string gets a red test
 * rather than a code review that may or may not happen.
 */
describe("soft is not gamification", () => {
  const BANNED =
    /\b(badge|badges|point|points|score|scored|streak|streaks|reward|rewards|award|awarded|congrat\w*|leaderboard|coin|coins|level up|unlocked?|trophy|achievement)\b/i;

  const everyString = [
    POSTURE_FOOTNOTE,
    ...POSTURE_CHOICES.flatMap((c) => [c.title, c.detail]),
    ...POSTURES.flatMap((p) => [
      takeoverPrompt(p),
      takeoverNote(p, { down: 4, hasLastRun: true }) ?? "",
      ...Object.keys(MILESTONE_COPY).flatMap((kind) => {
        const panel = milestonePanel(p, kind);
        return panel ? [panel.title, panel.note] : [];
      }),
    ]),
  ];

  it("uses none of the vocabulary of scoring", () => {
    for (const line of everyString) {
      expect(line, line).not.toMatch(BANNED);
    }
  });

  it("keeps the promise it makes on the choice screen", () => {
    // "Either way the bar is identical" is a claim about behaviour. It holds
    // because nothing in this module returns a number or a threshold — only
    // copy — so there is no path by which posture can reach a calculation.
    expect(POSTURE_FOOTNOTE).toContain("identical");
  });
});
