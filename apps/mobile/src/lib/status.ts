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

export type LeverRow = {
  id: string;
  key: string;
  label: string;
  position: number;
  archived: boolean;
};

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
        .select("logged_for, lever, detail")
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
        .select("id, key, label, position, archived")
        .eq("user_id", user.id)
        .eq("archived", false)
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

  const entries = (entryRes.data ?? []) as Entry[];
  const levers = (leverRes.data ?? []) as LeverRow[];
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
    leverCount: levers.length,
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
 * Log one lever for today.
 *
 * Idempotent by design — the unique constraint on
 * `(user_id, logged_for, lever)` means re-tapping is an update, never a
 * duplicate. That property is what makes the offline outbox safe to retry.
 */
export async function logEntry(
  userId: string,
  lever: string,
  detail?: string | null,
) {
  const day = today();
  let playbookId: string | null = null;

  const trimmed = detail?.trim();
  if (trimmed) {
    const label = trimmed.slice(0, 80);
    const { data: item } = await supabase
      .from("playbook")
      .upsert(
        { user_id: userId, lever, label },
        { onConflict: "user_id,lever,label" },
      )
      .select("id, use_count")
      .single();

    if (item) {
      playbookId = item.id;
      await supabase
        .from("playbook")
        .update({
          use_count: (item.use_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
  }

  return supabase.from("entries").upsert(
    {
      user_id: userId,
      logged_for: day,
      lever,
      detail: trimmed || null,
      playbook_id: playbookId,
    },
    { onConflict: "user_id,logged_for,lever" },
  );
}

/** Undo today's entry for a lever. A mistake should cost one tap to fix. */
export async function undoEntry(userId: string, lever: string) {
  return supabase
    .from("entries")
    .delete()
    .eq("user_id", userId)
    .eq("logged_for", today())
    .eq("lever", lever);
}

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
