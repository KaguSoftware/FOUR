import { describe, expect, it } from "vitest";
import { dayDetail, leverLabels, type Action } from "./day";
import {
  allTime,
  currentRun,
  downDays,
  upDates,
  uptimeWindow,
  type Entry,
} from "./uptime";

const labels = leverLabels([
  { key: "gym", label: "Gym" },
  { key: "food", label: "Food" },
]);

const on = (logged_for: string, lever: string, detail: string | null = null) =>
  ({ logged_for, lever, detail }) as Entry;

const act = (
  logged_for: string,
  lever: string,
  label: string,
  position: number,
): Action => ({ logged_for, lever, label, position });

describe("dayDetail", () => {
  it("names a lever as it is named now, and falls back to the key", () => {
    const d = dayDetail("2026-07-01", [on("2026-07-01", "gym")], [], labels, "2026-07-02");
    expect(d.levers[0].label).toBe("Gym");

    // A lever logged before it was archived and dropped from the map still has
    // to name itself. The raw key is the honest last resort.
    const gone = dayDetail("2026-07-01", [on("2026-07-01", "sauna")], [], labels, "2026-07-02");
    expect(gone.levers[0].label).toBe("sauna");
  });

  it("separates empty from future — a day that has not happened is not a day missed", () => {
    const past = dayDetail("2026-07-01", [], [], labels, "2026-07-02");
    expect(past.empty).toBe(true);
    expect(past.future).toBe(false);

    const ahead = dayDetail("2026-07-03", [], [], labels, "2026-07-02");
    expect(ahead.future).toBe(true);
  });

  describe("actions", () => {
    it("keeps ONE lever holding several actions, not the lever twice", () => {
      // The whole point of the split. "treadmill" and "walk" on one lever is
      // one lever that fired, with two things done under it.
      const d = dayDetail(
        "2026-07-05",
        [on("2026-07-05", "gym", "treadmill · walk")],
        [],
        labels,
        "2026-07-06",
        [
          act("2026-07-05", "gym", "treadmill", 1),
          act("2026-07-05", "gym", "walk", 2),
        ],
      );

      expect(d.levers).toHaveLength(1);
      expect(d.levers[0].actions).toEqual(["treadmill", "walk"]);
    });

    it("orders actions by position, not by the order they arrive", () => {
      const d = dayDetail(
        "2026-07-05",
        [on("2026-07-05", "gym")],
        [],
        labels,
        "2026-07-06",
        [
          act("2026-07-05", "gym", "second", 2),
          act("2026-07-05", "gym", "first", 1),
        ],
      );

      expect(d.levers[0].actions).toEqual(["first", "second"]);
    });

    it("keeps each lever's actions to itself", () => {
      const d = dayDetail(
        "2026-07-05",
        [on("2026-07-05", "gym"), on("2026-07-05", "food")],
        [],
        labels,
        "2026-07-06",
        [
          act("2026-07-05", "gym", "treadmill", 1),
          act("2026-07-05", "food", "shake", 1),
        ],
      );

      expect(d.levers.find((l) => l.key === "gym")?.actions).toEqual(["treadmill"]);
      expect(d.levers.find((l) => l.key === "food")?.actions).toEqual(["shake"]);
    });

    it("ignores actions belonging to another day", () => {
      const d = dayDetail(
        "2026-07-05",
        [on("2026-07-05", "gym")],
        [],
        labels,
        "2026-07-06",
        [act("2026-07-04", "gym", "yesterday", 1)],
      );

      expect(d.levers[0].actions).toEqual([]);
    });

    it("leaves actions empty for a client that never passes them", () => {
      // Backward compatibility: a day written before the split has only the
      // joined string, and `detail` still carries it.
      const d = dayDetail(
        "2026-07-05",
        [on("2026-07-05", "gym", "treadmill · walk")],
        [],
        labels,
        "2026-07-06",
      );

      expect(d.levers[0].actions).toEqual([]);
      expect(d.levers[0].detail).toBe("treadmill · walk");
    });
  });
});

describe("the split cannot move uptime", () => {
  /**
   * The load-bearing property of the whole actions round.
   *
   * Uptime is derived from DISTINCT DAYS that have an entry, never from row
   * counts — so however many actions a day accumulates, the figures are
   * identical. The `actions` table adds no `entries` rows, which is exactly
   * why it was chosen over widening the entries key.
   */
  it("gives the same figures however many actions a day holds", () => {
    const today = "2026-07-02";
    const one: Entry[] = [
      on("2026-07-01", "gym", "treadmill"),
      on("2026-07-02", "gym", "treadmill"),
    ];
    // The same two days, each now recording several things done.
    const many: Entry[] = [
      on("2026-07-01", "gym", "treadmill · walk · rows"),
      on("2026-07-02", "gym", "treadmill · swim"),
    ];

    expect(upDates(many)).toEqual(upDates(one));
    expect(uptimeWindow(many, today)).toEqual(uptimeWindow(one, today));
    expect(currentRun(many, today)).toEqual(currentRun(one, today));
    expect(downDays(many, today)).toEqual(downDays(one, today));
    expect(allTime(many, today)).toEqual(allTime(one, today));
  });

  it("counts a day once even when both levers fired several things", () => {
    const today = "2026-07-01";
    const busy: Entry[] = [
      on("2026-07-01", "gym", "treadmill · walk"),
      on("2026-07-01", "food", "shake · salad"),
    ];

    // Two levers, four things done, still exactly one day up.
    expect(upDates(busy).size).toBe(1);
    expect(uptimeWindow(busy, today).up).toBe(1);
  });
});
