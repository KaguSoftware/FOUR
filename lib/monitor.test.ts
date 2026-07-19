import { describe, expect, it } from "vitest";
import {
  evaluateFade,
  evaluatePlateau,
  pendingMilestones,
  pickMilestone,
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
  const weekly = (values: number[]) =>
    values.map((v, i) => ({
      observed_on: addDays(today, -7 * (values.length - 1 - i)),
      kind: "energy",
      value: v,
    }));

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
    // Two samples only. Silence is not evidence of a plateau.
    const r = evaluatePlateau({
      signals: weekly([3, 3]),
      uptimePct: 93,
      today,
      lastPlateauOn: null,
    });
    expect(r.flat).toBe(false);
    expect(r.reason).toContain("only 2 weeks");
  });
});
