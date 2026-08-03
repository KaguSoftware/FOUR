import { describe, expect, it } from "vitest";
import {
  ACTIVITY_FULL_COPY,
  ACTIVITY_LABEL_MAX,
  MAX_ACTIVITIES,
  canAddActivity,
  findActivity,
  normalizeActivityLabel,
  rankActivities,
  retireCandidate,
  validateActivityLabel,
  type ActivityRow,
} from "./playbook";

let seq = 0;
const row = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  id: `id-${++seq}`,
  lever: "gym",
  label: `activity ${seq}`,
  use_count: 0,
  last_used_at: null,
  is_pinned: false,
  archived: false,
  ...over,
});

/** `n` unremarkable, evictable rows. */
const fill = (n: number, over: Partial<ActivityRow> = {}) =>
  Array.from({ length: n }, () => row(over));

describe("validateActivityLabel", () => {
  it("rejects nothing at all", () => {
    expect(validateActivityLabel("")).toMatchObject({ ok: false });
    expect(validateActivityLabel("   ")).toMatchObject({ ok: false });
    expect(validateActivityLabel("\n\t ")).toMatchObject({ ok: false });
  });

  it("accepts a label at the ceiling and rejects one past it", () => {
    expect(validateActivityLabel("x".repeat(ACTIVITY_LABEL_MAX))).toEqual({
      ok: true,
    });
    expect(
      validateActivityLabel("x".repeat(ACTIVITY_LABEL_MAX + 1)),
    ).toMatchObject({ ok: false });
  });

  it("counts code points, the way Postgres does", () => {
    // The trap: Postgres `length()` counts characters, JS `.length` counts
    // UTF-16 code units. An emoji is 1 to the DB and 2 to JS, so counting the
    // JS way lets someone type a label `playbook_label_len` then refuses — and
    // the rejection surfaces as a failed save with a constraint name in it.
    const eighty = "🏋".repeat(ACTIVITY_LABEL_MAX);
    expect(eighty.length).toBe(ACTIVITY_LABEL_MAX * 2); // JS disagrees
    expect(validateActivityLabel(eighty)).toEqual({ ok: true });
    expect(
      validateActivityLabel("🏋".repeat(ACTIVITY_LABEL_MAX + 1)),
    ).toMatchObject({ ok: false });
  });

  it("explains what to do rather than just refusing", () => {
    const bad = validateActivityLabel("");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason.length).toBeGreaterThan(10);
  });
});

describe("normalizeActivityLabel", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeActivityLabel("  shake   @  lunch \n")).toBe(
      "shake @ lunch",
    );
  });

  it("truncates by code point, never mid-character", () => {
    const out = normalizeActivityLabel("🏋".repeat(200));
    expect([...out]).toHaveLength(ACTIVITY_LABEL_MAX);
    // A code-unit slice would leave a LONE surrogate at the end, which renders
    // as a replacement character and round-trips through the DB as one. A
    // paired one is fine — that is what an emoji is made of.
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)).toBe(false);
  });

  it("is idempotent", () => {
    const once = normalizeActivityLabel("  treadmill +  2 machines ");
    expect(normalizeActivityLabel(once)).toBe(once);
  });
});

describe("canAddActivity", () => {
  it("stops at ten", () => {
    expect(canAddActivity(MAX_ACTIVITIES - 1)).toBe(true);
    expect(canAddActivity(MAX_ACTIVITIES)).toBe(false);
    expect(canAddActivity(MAX_ACTIVITIES + 5)).toBe(false);
  });

  it("refuses a nonsense count rather than opening the gate", () => {
    expect(canAddActivity(-1)).toBe(false);
    expect(canAddActivity(NaN)).toBe(false);
  });

  it("keeps the copy and the number in step", () => {
    expect(MAX_ACTIVITIES).toBe(10);
    expect(ACTIVITY_FULL_COPY).toMatch(/ten/i);
  });
});

describe("findActivity", () => {
  it("matches ignoring case and surrounding whitespace", () => {
    const rows = [row({ label: "Shake @ lunch" })];
    expect(findActivity(rows, "shake @ lunch")?.label).toBe("Shake @ lunch");
    expect(findActivity(rows, "  SHAKE @ LUNCH  ")?.label).toBe(
      "Shake @ lunch",
    );
  });

  it("does not match a genuinely different label", () => {
    expect(findActivity([row({ label: "squats" })], "squat")).toBeUndefined();
  });
});

describe("rankActivities", () => {
  it("puts pinned first, then most used", () => {
    const pinned = row({ label: "pinned", use_count: 0, is_pinned: true });
    const busy = row({ label: "busy", use_count: 9 });
    const quiet = row({ label: "quiet", use_count: 1 });
    expect(rankActivities([quiet, busy, pinned]).map((r) => r.label)).toEqual([
      "pinned",
      "busy",
      "quiet",
    ]);
  });

  it("tie-breaks on recency, with never-used last", () => {
    const recent = row({ use_count: 2, last_used_at: "2026-08-01T00:00:00Z", label: "recent" });
    const old = row({ use_count: 2, last_used_at: "2026-01-01T00:00:00Z", label: "old" });
    const never = row({ use_count: 2, last_used_at: null, label: "never" });
    expect(rankActivities([never, old, recent]).map((r) => r.label)).toEqual([
      "recent",
      "old",
      "never",
    ]);
  });

  it("is fully determined, so two identical loads cannot reshuffle", () => {
    // Without the alphabetical floor the order of two otherwise-equal rows is
    // whatever the database happened to return, and the picker flickers.
    const a = row({ label: "alpha" });
    const b = row({ label: "beta" });
    expect(rankActivities([b, a]).map((r) => r.label)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(rankActivities([a, b]).map((r) => r.label)).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("excludes archived rows", () => {
    const live = row({ label: "live" });
    const gone = row({ label: "gone", archived: true, use_count: 99 });
    expect(rankActivities([gone, live]).map((r) => r.label)).toEqual(["live"]);
  });

  it("does not mutate its input", () => {
    // Callers pass `status.playbook` straight in; sorting it in place would
    // reorder shared state under whatever else is reading it.
    const rows = [row({ use_count: 1 }), row({ use_count: 9 })];
    const before = rows.map((r) => r.id);
    rankActivities(rows);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe("retireCandidate", () => {
  it("retires nothing while there is room", () => {
    expect(retireCandidate(fill(MAX_ACTIVITIES - 1), "new one")).toBeNull();
    expect(retireCandidate([], "new one")).toBeNull();
  });

  it("retires nothing when the label is already there", () => {
    // An upsert onto an existing row does not grow the set. Evicting here
    // would throw one away on every repeat log — the most common path there is.
    const rows = [...fill(MAX_ACTIVITIES - 1), row({ label: "shake" })];
    expect(retireCandidate(rows, "shake")).toBeNull();
    expect(retireCandidate(rows, "  SHAKE ")).toBeNull();
  });

  it("picks the least-used row at the cap", () => {
    const rows = fill(MAX_ACTIVITIES - 1, { use_count: 1 });
    const lonely = row({ label: "lonely", use_count: 0 });
    expect(retireCandidate([...rows, lonely], "new")?.label).toBe("lonely");
  });

  it("never evicts a pinned row while an unpinned one exists", () => {
    const pinned = row({ label: "pinned", use_count: 0, is_pinned: true });
    const plain = row({ label: "plain", use_count: 1 });
    const rows = [pinned, plain, ...fill(MAX_ACTIVITIES - 2, { use_count: 5 })];
    expect(retireCandidate(rows, "new")?.label).toBe("plain");
  });

  it("never evicts a pinned row even when it is the only candidate left", () => {
    // The user marked that one deliberately. Silently archiving it because
    // they typed a one-off detail is exactly the surprise the rule forbids.
    const rows = [
      row({ label: "pinned", use_count: 0, is_pinned: true }),
      ...fill(MAX_ACTIVITIES - 1, { use_count: 8 }),
    ];
    expect(retireCandidate(rows, "new")).toBeNull();
  });

  it("never evicts anything done more than once", () => {
    // Twice is a habit, not a one-off. When nothing is safe to evict the
    // caller creates nothing — the entry still logs with its full detail.
    expect(retireCandidate(fill(MAX_ACTIVITIES, { use_count: 2 }), "new")).toBeNull();
  });

  it("tie-breaks on the longest untouched, nulls first", () => {
    const never = row({ label: "never", use_count: 0, last_used_at: null });
    const stale = row({ label: "stale", use_count: 0, last_used_at: "2026-01-01T00:00:00Z" });
    const rows = [stale, never, ...fill(MAX_ACTIVITIES - 2, { use_count: 7 })];
    expect(retireCandidate(rows, "new")?.label).toBe("never");
  });

  it("is deterministic for two otherwise identical rows", () => {
    const a = row({ label: "alpha", use_count: 0 });
    const b = row({ label: "beta", use_count: 0 });
    const rest = fill(MAX_ACTIVITIES - 2, { use_count: 9 });
    expect(retireCandidate([b, a, ...rest], "new")?.label).toBe("alpha");
    expect(retireCandidate([a, b, ...rest], "new")?.label).toBe("alpha");
  });

  it("counts only live rows toward the cap", () => {
    // Archived rows are out of the picker and out of the count. Ten live plus
    // five archived is still exactly at the cap, not over it.
    const rows = [
      ...fill(MAX_ACTIVITIES - 1, { use_count: 3 }),
      ...fill(5, { archived: true }),
    ];
    expect(retireCandidate(rows, "new")).toBeNull();
  });
});
