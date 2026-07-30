import { describe, expect, it } from "vitest";
import {
  evaluateFade,
  evaluatePlateau,
  isoWeekKey,
  MILESTONE_COPY,
  pendingMilestones,
  pickMilestone,
  RUN_MILESTONES,
  UPTIME_MILESTONES,
} from "./monitor";
import { addDays, type Entry } from "./uptime";

const PLAYBOOK = ["shake @ lunch", "treadmill + 2 machines"];

const fade = (over: Partial<Parameters<typeof evaluateFade>[0]>) =>
  evaluateFade({
    down: 0,
    slammed: false,
    today: "2026-07-19",
    lastPagedOn: null,
    lastPagedLevel: null,
    topPlaybook: PLAYBOOK,
    ...over,
  });

const span = (from: string, days: number): Entry[] =>
  Array.from({ length: days }, (_, i) => ({
    logged_for: addDays(from, i),
    lever: "gym" as const,
    detail: null,
  }));

describe("fade monitor — normal mode", () => {
  it("stays silent at 1 day down; a missed day is noise, not signal", () => {
    expect(fade({ down: 1 }).kind).toBe("none");
  });

  it("pages at 2 days", () => {
    const r = fade({ down: 2 });
    expect(r.kind).toBe("page");
    if (r.kind === "page") {
      expect(r.level).toBe(1);
      expect(r.text).toContain("DOWN 2 DAYS");
    }
  });

  it("escalates at 3 days and includes the playbook", () => {
    const r = fade({ down: 3 });
    expect(r.kind).toBe("page");
    if (r.kind === "page") {
      expect(r.level).toBe(2);
      expect(r.text).toContain("shake @ lunch");
    }
  });

  it("drops to weekly past a week — daily nagging gets muted, and a muted monitor is dead", () => {
    // 3 days after the last page: suppressed.
    expect(
      fade({ down: 9, lastPagedOn: addDays("2026-07-19", -3), lastPagedLevel: 3 })
        .kind,
    ).toBe("none");
    // 8 days after: fires again.
    expect(
      fade({ down: 14, lastPagedOn: addDays("2026-07-19", -8), lastPagedLevel: 3 })
        .kind,
    ).toBe("page");
  });

  it("never pages twice in one day, even if cron double-fires", () => {
    expect(fade({ down: 4, lastPagedOn: "2026-07-19" }).kind).toBe("none");
  });

  it("does not re-send the same tier the next day", () => {
    const r = fade({
      down: 3,
      lastPagedOn: addDays("2026-07-19", -1),
      lastPagedLevel: 2,
    });
    expect(r.kind).toBe("none");
  });
});

describe("fade monitor — slammed mode", () => {
  it("moves the threshold out but still pages; crunch is when a pause turns permanent", () => {
    expect(fade({ down: 2, slammed: true }).kind).toBe("none");
    expect(fade({ down: 3, slammed: true }).kind).toBe("page");
  });

  it("still escalates and still goes weekly", () => {
    expect(fade({ down: 4, slammed: true }).kind).toBe("page");
    expect(
      fade({
        down: 9,
        slammed: true,
        lastPagedOn: addDays("2026-07-19", -2),
        lastPagedLevel: 3,
      }).kind,
    ).toBe("none");
  });
});

describe("milestones", () => {
  const today = "2026-07-19";

  it("fires at a real threshold", () => {
    const entries = span(addDays(today, -13), 14);
    const pending = pendingMilestones({ entries, today, alreadyFired: new Set() });
    expect(pending).toContain("run_14");
    expect(pending).toContain("run_7");
  });

  it("sends only the highest when several land together", () => {
    const entries = span(addDays(today, -29), 30);
    const pending = pendingMilestones({ entries, today, alreadyFired: new Set() });
    expect(pickMilestone(pending)).toBe("run_30");
  });

  it("never re-fires a threshold that already fired — nothing to farm", () => {
    const entries = span(addDays(today, -13), 14);
    const pending = pendingMilestones({
      entries,
      today,
      alreadyFired: new Set(["run_7", "run_14"]),
    });
    expect(pending).not.toContain("run_14");
    expect(pickMilestone(pending)).toBeNull();
  });

  it("re-crossing 14 days on a later run is silent", () => {
    const entries = [...span("2026-01-01", 20), ...span(addDays(today, -13), 14)];
    const pending = pendingMilestones({
      entries,
      today,
      alreadyFired: new Set(["run_7", "run_14"]),
    });
    expect(pending.filter((k) => k.startsWith("run_"))).toEqual([]);
  });
});

describe("plateau monitor", () => {
  const today = "2026-07-19";
  /**
   * One value per week, expressed as the daily samples that produce it. Weeks
   * are the unit of meaning, but days are the unit of input, so a "week" here
   * is a properly-sampled one rather than a single lonely row.
   */
  const weekly = (values: number[], perWeek = 5) =>
    values.flatMap((v, i) =>
      Array.from({ length: perWeek }, (_, d) => ({
        observed_on: addDays(today, -7 * (values.length - 1 - i) - d),
        kind: "energy",
        value: v,
      })),
    );

  it("stays silent while signals are rising", () => {
    const r = evaluatePlateau({
      signals: weekly([2, 3, 3, 4]),
      uptimePct: 90,
      today,
      lastPlateauOn: null,
    });
    expect(r.flat).toBe(false);
  });

  it("fires when signals go flat while uptime holds — the state a long run dies in", () => {
    const r = evaluatePlateau({
      signals: weekly([3, 3, 3, 3]),
      uptimePct: 93,
      today,
      lastPlateauOn: null,
    });
    expect(r.flat).toBe(true);
  });

  it("defers to the fade monitor when uptime is low; no double-paging", () => {
    const r = evaluatePlateau({
      signals: weekly([3, 3, 3, 3]),
      uptimePct: 40,
      today,
      lastPlateauOn: null,
    });
    expect(r.flat).toBe(false);
  });

  it("respects the 6-week cooldown", () => {
    const r = evaluatePlateau({
      signals: weekly([3, 3, 3, 3]),
      uptimePct: 93,
      today,
      lastPlateauOn: addDays(today, -21),
    });
    expect(r.flat).toBe(false);
  });

  it("treats missing weeks as unknown, never as a flat line", () => {
    // Two sampled weeks only. Silence is not evidence of a plateau.
    const r = evaluatePlateau({
      signals: weekly([3, 3]),
      uptimePct: 93,
      today,
      lastPlateauOn: null,
    });
    expect(r.flat).toBe(false);
    expect(r.reason).toContain("only 2 weeks");
  });

  // --- daily sampling -------------------------------------------------------
  // Input is daily now, but the window is still four real weeks. These pin the
  // fold so a dense stretch of days can never masquerade as a long trend.

  it("does not fire on four flat days — four days is a mood, not a plateau", () => {
    const r = evaluatePlateau({
      signals: [3, 3, 3, 3].map((v, i) => ({
        observed_on: addDays(today, -i),
        kind: "energy",
        value: v,
      })),
      uptimePct: 93,
      today,
      lastPlateauOn: null,
    });
    expect(r.flat).toBe(false);
    expect(r.reason).toContain("only 1 weeks");
  });

  it("drops thinly-sampled weeks rather than trusting one stray day", () => {
    // Four weeks on the calendar, but only 1 day sampled in each: not enough
    // to call any of them a week, so there is nothing to conclude.
    const r = evaluatePlateau({
      signals: weekly([3, 3, 3, 3], 1),
      uptimePct: 93,
      today,
      lastPlateauOn: null,
    });
    expect(r.flat).toBe(false);
    expect(r.reason).toContain("only 0 weeks");
  });
});

describe("isoWeekKey", () => {
  it("groups days of the same week under one key", () => {
    // Mon 2026-07-13 .. Sun 2026-07-19 are one ISO week.
    const keys = [13, 14, 15, 16, 17, 18, 19].map((d) =>
      isoWeekKey(`2026-07-${d}`),
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("splits across the Monday boundary", () => {
    expect(isoWeekKey("2026-07-19")).not.toBe(isoWeekKey("2026-07-20"));
  });

  it("sorts chronologically as a string, including across a year boundary", () => {
    const a = isoWeekKey("2025-12-29"); // ISO week 1 of 2026
    const b = isoWeekKey("2026-01-05");
    expect(a < b).toBe(true);
    expect(a.startsWith("2026-")).toBe(true);
  });
});

describe("milestone copy", () => {
  it("exists for every milestone that can fire", () => {
    // A milestone kind without copy would render as a blank line — the monitor
    // and the dashboards both index MILESTONE_COPY by the kinds these two
    // arrays generate, so the three must never drift apart.
    for (const d of RUN_MILESTONES) {
      expect(MILESTONE_COPY[`run_${d}`], `run_${d}`).toBeTruthy();
      expect(MILESTONE_COPY[`run_${d}`]).toContain(String(d));
    }
    for (const p of UPTIME_MILESTONES) {
      expect(MILESTONE_COPY[`uptime_${p}`], `uptime_${p}`).toBeTruthy();
      expect(MILESTONE_COPY[`uptime_${p}`]).toContain(String(p));
    }
    expect(Object.keys(MILESTONE_COPY)).toHaveLength(
      RUN_MILESTONES.length + UPTIME_MILESTONES.length,
    );
  });

  /**
   * The guard that keeps milestones from drifting into the category this
   * product rejects. A milestone notices; it does not reward.
   *
   * Scanning the copy is a blunt check, and that is why it works: the first
   * person to write "streak" or "reward" into a milestone string gets a red
   * test rather than a code review that may or may not happen.
   */
  it("uses none of the vocabulary of scoring", () => {
    const BANNED =
      /\b(badge|badges|point|points|score|scored|streak|streaks|reward|rewards|award|awarded|congrat\w*|leaderboard|coin|coins|level up|unlocked?|trophy|achievement)\b/i;
    for (const line of Object.values(MILESTONE_COPY)) {
      expect(line, line).not.toMatch(BANNED);
    }
  });
});
