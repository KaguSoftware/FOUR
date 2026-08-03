/**
 * Activities — the per-lever playbook, and the rules for keeping it useful.
 *
 * An activity is a thing that has already worked, remembered so restarting is
 * reopening a file rather than facing a blank page. It is stored one row per
 * `(user, lever, label)` and surfaced as the chips in the lever sheet and in
 * the takeover.
 *
 * Until 2026-08-03 these could only ever be CREATED — written as a side effect
 * of logging a lever with a detail, never renamed, never removed, never
 * counted. A typo lived forever, and the list grew without bound behind a
 * picker that only ever showed three. This module is the rules that fixes.
 *
 * Lives in core, and mirrors `levers.ts` deliberately: same shape of
 * validator, same shape of ceiling predicate, same reason. Two clients
 * disagreeing about which three activities are "the top three" is two answers
 * to one question.
 */

/**
 * Ten active activities per lever.
 *
 * Not a storage limit — the rows are tiny. It is a limit on the list a person
 * has to read and maintain. Past about ten, a picker stops being "the things
 * that work" and becomes a search problem, and the whole value of the feature
 * is that the answer is already on screen.
 */
export const MAX_ACTIVITIES = 10;

/** Matches `playbook_label_len`: `length(btrim(label)) between 1 and 80`. */
export const ACTIVITY_LABEL_MAX = 80;

/**
 * What an editor says when the list is full.
 *
 * One string so the word and the number cannot drift apart — the four-lever
 * ceiling has the same arrangement, for the same reason.
 */
export const ACTIVITY_FULL_COPY =
  "Ten is the maximum. Delete one to add another.";

export type ActivityRow = {
  id: string;
  lever: string;
  label: string;
  use_count: number;
  /** ISO timestamp, or null for one never used since the column existed. */
  last_used_at: string | null;
  is_pinned: boolean;
  archived: boolean;
};

export type ActivityCheck = { ok: true } | { ok: false; reason: string };

/**
 * Trim, collapse internal whitespace, and truncate.
 *
 * **Truncation counts code points, not UTF-16 code units.** Postgres `length()`
 * counts characters, so an emoji is 1 there and 2 to JavaScript's `.length`.
 * A client that permitted 80 units would let someone type a label the database
 * then refuses, and the rejection arrives as a failed save with a constraint
 * name in it. `[...label]` iterates code points, which is what the DB agrees
 * with.
 */
export function normalizeActivityLabel(label: string): string {
  const collapsed = label.replace(/\s+/g, " ").trim();
  const points = [...collapsed];
  return points.length <= ACTIVITY_LABEL_MAX
    ? collapsed
    : points.slice(0, ACTIVITY_LABEL_MAX).join("").trim();
}

/**
 * Validate a label the user typed.
 *
 * Rejects only what the database would reject, so nothing can pass here and
 * fail there. Errors say what to do about it — see `validateLeverLabel`.
 */
export function validateActivityLabel(label: string): ActivityCheck {
  const trimmed = label.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "Give the activity a name." };
  }
  if ([...trimmed].length > ACTIVITY_LABEL_MAX) {
    return {
      ok: false,
      reason: `Keep it under ${ACTIVITY_LABEL_MAX} characters — it has to fit on one line.`,
    };
  }
  return { ok: true };
}

/** Whether another activity can be added to this lever. Ten is the ceiling. */
export function canAddActivity(currentActive: number): boolean {
  if (!Number.isFinite(currentActive) || currentActive < 0) return false;
  return currentActive < MAX_ACTIVITIES;
}

/** Case- and whitespace-insensitive, matching what the unique key means. */
function same(a: string, b: string): boolean {
  return (
    a.replace(/\s+/g, " ").trim().toLowerCase() ===
    b.replace(/\s+/g, " ").trim().toLowerCase()
  );
}

/** An activity by label, ignoring case and surrounding whitespace. */
export function findActivity(
  rows: readonly ActivityRow[],
  label: string,
): ActivityRow | undefined {
  return rows.find((r) => same(r.label, label));
}

/**
 * Display order: pinned, then most used, then most recent, then alphabetical.
 *
 * **Every surface sorts through this** — both pickers, both editors, both
 * takeovers. The two clients previously ordered differently (the web query
 * tie-broke on `last_used_at`, the mobile one did not), so the "top three" on
 * a phone and the "top three" in a browser could be different three. That is
 * precisely the class of divergence this package exists to make impossible.
 *
 * The final alphabetical tie-break is not decoration: without it the order of
 * two never-used activities depends on whatever order the database happened to
 * return, which means the picker can reshuffle between two identical loads.
 *
 * Archived rows are excluded. Returns a new array — callers pass status objects
 * straight in, and sorting one in place mutates shared state.
 */
export function rankActivities(
  rows: readonly ActivityRow[],
): ActivityRow[] {
  return rows
    .filter((r) => !r.archived)
    .slice()
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.use_count !== b.use_count) return b.use_count - a.use_count;
      // Nulls last: never used is not more recent than used-once-last-year.
      if (a.last_used_at !== b.last_used_at) {
        if (a.last_used_at === null) return 1;
        if (b.last_used_at === null) return -1;
        return a.last_used_at < b.last_used_at ? 1 : -1;
      }
      return a.label.localeCompare(b.label);
    });
}

/**
 * Which activity an IMPLICIT create should retire, or null if it must not
 * retire anything.
 *
 * The cap has two halves, and they are deliberately not symmetric.
 *
 * An **explicit** add — someone in the editor, typing into the add field —
 * is refused at ten with `ACTIVITY_FULL_COPY`. They are looking at the list;
 * telling them it is full is an answer they can act on.
 *
 * An **implicit** create — logging a lever with a detail the playbook has not
 * seen — must never be refused, because refusing it means blocking a log, and
 * *a missed log is a lost day*. So at the cap it retires something instead.
 * But only something provably harmless:
 *
 * - never pinned — the user marked that one deliberately;
 * - never `use_count > 1` — anything done twice is a habit, not a one-off.
 *
 * If nothing qualifies, this returns `null` and **the caller creates nothing**.
 * The entry still writes with its full `detail` and a null `playbook_id`; the
 * playbook simply stops learning until the list is pruned. That is honest and
 * lossless, and it is much better than the alternative of silently evicting
 * something someone relies on because they typed a one-off on a Tuesday.
 *
 * Also returns `null` when the label is already present: an upsert onto an
 * existing row does not grow the set, so there is nothing to make room for.
 * Getting that wrong would evict a row on every repeat log.
 */
export function retireCandidate(
  active: readonly ActivityRow[],
  incomingLabel: string,
): ActivityRow | null {
  const live = active.filter((r) => !r.archived);
  if (live.length < MAX_ACTIVITIES) return null;
  if (findActivity(live, incomingLabel)) return null;

  const evictable = live.filter((r) => !r.is_pinned && r.use_count <= 1);
  if (evictable.length === 0) return null;

  // Least entrenched first: fewest uses, then longest untouched, then oldest
  // by label so the choice is deterministic rather than query-order dependent.
  return evictable.slice().sort((a, b) => {
    if (a.use_count !== b.use_count) return a.use_count - b.use_count;
    if (a.last_used_at !== b.last_used_at) {
      // Nulls FIRST here — never used is the most evictable thing there is.
      if (a.last_used_at === null) return -1;
      if (b.last_used_at === null) return 1;
      return a.last_used_at < b.last_used_at ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  })[0];
}
