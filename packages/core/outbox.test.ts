import { describe, expect, it } from "vitest";
import {
  applyToDay,
  capped,
  enqueue,
  oldestAgeDays,
  pending,
  settle,
  OUTBOX_MAX,
  type OutboxItem,
} from "./outbox";

const item = (
  lever: string,
  op: "log" | "undo",
  queued_at = 1,
  logged_for = "2026-07-28",
): OutboxItem => ({ lever, op, logged_for, detail: null, queued_at });

describe("enqueue", () => {
  it("keeps one intent per day and lever, not a history of taps", () => {
    // Log, undo, log again while offline is ONE final state. Replaying three
    // writes would only be correct if ordering were guaranteed, and it would
    // still be three round trips to reach a state one describes.
    let q: OutboxItem[] = [];
    q = enqueue(q, item("gym", "log", 1));
    q = enqueue(q, item("gym", "undo", 2));
    q = enqueue(q, item("gym", "log", 3));

    expect(q).toHaveLength(1);
    expect(q[0].op).toBe("log");
    expect(q[0].queued_at).toBe(3);
  });

  it("keeps different levers on the same day apart", () => {
    let q: OutboxItem[] = [];
    q = enqueue(q, item("gym", "log"));
    q = enqueue(q, item("food", "log"));
    expect(q).toHaveLength(2);
  });

  it("keeps the same lever on different days apart", () => {
    let q: OutboxItem[] = [];
    q = enqueue(q, item("gym", "log", 1, "2026-07-27"));
    q = enqueue(q, item("gym", "log", 2, "2026-07-28"));
    expect(q).toHaveLength(2);
  });

  it("does not mutate the queue it was given", () => {
    const original: OutboxItem[] = [item("gym", "log")];
    enqueue(original, item("food", "log"));
    expect(original).toHaveLength(1);
  });
});

describe("settle", () => {
  it("removes only the key the server accepted", () => {
    const q = [item("gym", "log"), item("food", "log")];
    expect(settle(q, { logged_for: "2026-07-28", lever: "gym" })).toEqual([
      item("food", "log"),
    ]);
  });

  it("is a no-op for something not queued", () => {
    const q = [item("gym", "log")];
    expect(settle(q, { logged_for: "2026-07-28", lever: "nope" })).toEqual(q);
  });
});

describe("pending", () => {
  it("sends oldest intent first", () => {
    const q = [item("a", "log", 30), item("b", "log", 10)];
    expect(pending(q).map((i) => i.lever)).toEqual(["b", "a"]);
  });
});

describe("applyToDay", () => {
  it("shows a queued tap the server has not seen", () => {
    expect(applyToDay([], [item("gym", "log")], "2026-07-28")).toEqual(["gym"]);
  });

  it("hides a queued undo of something the server still has", () => {
    expect(applyToDay(["gym"], [item("gym", "undo")], "2026-07-28")).toEqual([]);
  });

  it("keeps a lever logged on another device", () => {
    // The server list is the base; the queue only overrides what it mentions.
    const out = applyToDay(["food"], [item("gym", "log")], "2026-07-28");
    expect(out.sort()).toEqual(["food", "gym"]);
  });

  it("ignores intents for other days", () => {
    const q = [item("gym", "log", 1, "2026-07-27")];
    expect(applyToDay([], q, "2026-07-28")).toEqual([]);
  });

  it("never reports a lever twice", () => {
    expect(applyToDay(["gym"], [item("gym", "log")], "2026-07-28")).toEqual([
      "gym",
    ]);
  });
});

describe("oldestAgeDays", () => {
  const DAY = 86_400_000;

  it("is zero for an empty queue", () => {
    expect(oldestAgeDays([], 0)).toBe(0);
  });

  it("reports whole days since the oldest unsent tap", () => {
    // Worth surfacing: the user believes that day is up and it is not.
    const q = [item("gym", "log", 0), item("food", "log", 2 * DAY)];
    expect(oldestAgeDays(q, 3 * DAY)).toBe(3);
  });

  it("never reports a negative age from a clock that moved backwards", () => {
    expect(oldestAgeDays([item("gym", "log", 5 * DAY)], 0)).toBe(0);
  });
});

describe("capped", () => {
  it("leaves a normal queue alone", () => {
    const q = [item("gym", "log")];
    expect(capped(q)).toEqual(q);
  });

  it("drops the oldest first once past the ceiling", () => {
    const q = Array.from({ length: OUTBOX_MAX + 10 }, (_, i) =>
      item(`lever-${i}`, "log", i),
    );
    const out = capped(q);
    expect(out).toHaveLength(OUTBOX_MAX);
    // The newest intents survive; a two-month-old unsent tap is less useful
    // than this morning's.
    expect(out.at(-1)?.lever).toBe(`lever-${OUTBOX_MAX + 9}`);
  });
});
