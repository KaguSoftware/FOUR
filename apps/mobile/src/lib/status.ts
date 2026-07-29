import { supabase } from "./supabase";
import {
  allTime,
  currentRun,
  deriveIntervals,
  downDays,
  lastCompletedRun,
  logicalDateLocal,
  toPosture,
  uptimeWindow,
  type Entry,
  type LeverSpan,
  type Posture,
} from "@uptime/core";

/**
 * Everything a screen needs, in one pass.
 *
 * The port of `apps/web/lib/system.ts::getStatus()`. Three queries, then every
 * number on screen is DERIVED locally by `@uptime/core` — the same functions
 * the web app and the monitor run. No server round-trip computes anything, so
 * the dashboard is correct offline as long as the rows are cached.
 *
 * **Server Actions do not port.** The web client goes through `app/actions.ts`;
 * here we talk to Supabase directly, with RLS (`auth.uid() = user_id`, on all
 * eight tables) as the security boundary — exactly as the web *client* already
 * does for reads.
 */

/**
 * An entry, plus when the row was written.
 *
 * Core's `Entry` is deliberately `logged_for`/`lever`/`detail` — every figure
 * it derives keys on the DATE, never on write time. `created_at` is a UI
 * concern only: it is how the undo row knows which of today's taps was last.
 */
export type LoggedEntry = Entry & { created_at: string };

export type LeverRow = {
  id: string;
  key: string;
  label: string;
  position: number;
  archived: boolean;
  created_at: string;
  archived_at: string | null;
};

/**
 * Lever lifespans, for shading past days the way they looked at the time.
 *
 * Timestamps are sliced to their date. That is the UTC date rather than the
 * logical local one, so a lever created within four hours of midnight can land
 * a day either side. It moves one day's denominator by one and nothing else —
 * uptime, runs and every figure key on `entries` and are untouched.
 */
export const leverSpans = (levers: LeverRow[]): LeverSpan[] =>
  levers.map((l) => ({
    created_on: l.created_at.slice(0, 10),
    archived_on: l.archived_at?.slice(0, 10) ?? null,
  }));

export type PlaybookItem = {
  id: string;
  lever: string;
  label: string;
  use_count: number;
  is_pinned: boolean;
};

export type SystemState = {
  user_id: string;
  timezone: string;
  slammed_until: string | null;
  weight_enabled: boolean;
  weight_unit: "kg" | "lb";
  posture: Posture;
  onboarded: boolean;
};

/**
 * **Never `logicalDate()` here.** Hermes delegates `Intl` to platform ICU and
 * the behaviour varies by Android version — documented failures include
 * `RangeError: Invalid timezone name!` for valid IANA zones and the options
 * object being ignored outright. It can pass on a test device and fail on a
 * user's, and the failure mode is every date silently shifting by a day.
 *
 * `logicalDateLocal` uses no Intl at all. A phone's `Date` is already in the
 * user's local time, which is the timezone the 04:00 boundary actually means.
 */
export const today = () => logicalDateLocal(new Date());

export type Status = Awaited<ReturnType<typeof loadStatus>>;

export async function loadStatus() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = today();

  const [stateRes, entryRes, playbookRes, leverRes, milestoneRes] =
    await Promise.all([
      supabase
        .from("system_state")
        .select(
          "user_id, timezone, slammed_until, weight_enabled, weight_unit, posture, onboarded_at",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("entries")
        // `created_at` is what orders today's taps against each other. The
        // undo row walks back most-recent-first, and `logged_for` is the same
        // date for every entry it could undo.
        .select("logged_for, lever, detail, created_at")
        .eq("user_id", user.id)
        .order("logged_for", { ascending: true }),
      supabase
        .from("playbook")
        .select("id, lever, label, use_count, is_pinned")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("is_pinned", { ascending: false })
        .order("use_count", { ascending: false }),
      supabase
        .from("levers")
        // ARCHIVED ROWS INCLUDED, deliberately. The button list filters them
        // out below, but the grid needs to know a lever existed on a past day
        // in order to shade that day the way it looked at the time.
        .select("id, key, label, position, archived, created_at, archived_at")
        .eq("user_id", user.id)
        .order("position", { ascending: true }),
      supabase
        .from("milestones")
        .select("kind, first_hit_on")
        .eq("user_id", user.id)
        .order("first_hit_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const row = (stateRes.data ?? {}) as Record<string, unknown>;
  const state: SystemState = {
    user_id: user.id,
    timezone: (row.timezone as string | null) ?? "UTC",
    slammed_until: (row.slammed_until as string | null) ?? null,
    weight_enabled: row.weight_enabled === true,
    weight_unit: row.weight_unit === "lb" ? "lb" : "kg",
    posture: toPosture(row.posture),
    // No row yet means the signup trigger has not run — treat that as
    // un-onboarded rather than crashing, and let onboarding create it.
    onboarded: row.onboarded_at != null,
  };

  const entries = (entryRes.data ?? []) as LoggedEntry[];
  const allLevers = (leverRes.data ?? []) as LeverRow[];
  const levers = allLevers.filter((l) => !l.archived);
  const playbook = (playbookRes.data ?? []) as PlaybookItem[];
  const { runs, outages } = deriveIntervals(entries, now);

  const milestone = milestoneRes.data as
    | { kind: string; first_hit_on: string }
    | null;

  return {
    user,
    state,
    today: now,
    slammed: state.slammed_until !== null && state.slammed_until >= now,
    entries,
    levers,
    playbook,
    /** For the grid: who existed when, archived included. */
    leverSpans: leverSpans(allLevers),
    todayLevers: entries
      .filter((e) => e.logged_for === now)
      .map((e) => e.lever),
    uptime: uptimeWindow(entries, now),
    run: currentRun(entries, now),
    down: downDays(entries, now),
    runs,
    outages,
    allTime: allTime(entries, now),
    lastRun: lastCompletedRun(entries, now),
    // Live on screen for 24h after it first landed, then it is history.
    liveMilestone:
      milestone && milestone.first_hit_on >= now ? milestone.kind : null,
  };
}

/**
 * There is deliberately no `logEntry` / `undoEntry` here.
 *
 * Both existed, and both were a second way to write an entry alongside `send()`
 * in `lib/outbox.ts` — same upserts, same idempotency, different timing
 * behaviour. The log sheet used this pair and awaited the network before it
 * would dismiss; the dashboard used the outbox and felt instant. Two write
 * paths meant two answers to "when does a tap count", so the slow one is gone.
 *
 * Everything that logs or undoes goes through `queueWrite`.
 */

/**
 * Write the device's timezone back to `system_state`.
 *
 * The phone derives its logical day locally and never reads this column, but
 * the server-side monitor does — so if it drifts, the pager fires on a
 * different day than the one the user is looking at.
 */
export async function syncTimeZone(userId: string, timeZone: string) {
  if (!timeZone) return;
  return supabase
    .from("system_state")
    .update({ timezone: timeZone })
    .eq("user_id", userId);
}
