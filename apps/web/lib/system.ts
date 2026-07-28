import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  allTime,
  currentRun,
  deriveIntervals,
  downDays,
  lastCompletedRun,
  leverCount,
  logicalDate,
  uptimeWindow,
  type Entry,
  type Lever,
} from "@uptime/core";

export type PlaybookItem = {
  id: string;
  lever: Lever;
  label: string;
  use_count: number;
  is_pinned: boolean;
};

export type SystemState = {
  user_id: string;
  timezone: string;
  slammed_until: string | null;
  telegram_chat_id: string | null;
};

export const DEFAULT_TZ = "Europe/Istanbul";

// The lever set lives in @uptime/core so client components can read it without
// pulling next/headers into the browser bundle. Re-exported for server callers.
export { ACTIVE_LEVERS } from "@uptime/core";

export async function getSupabase() {
  return createClient(await cookies());
}

/**
 * Loads system_state, creating it on first access.
 *
 * The signup trigger handles new accounts, but an account created before the
 * trigger existed (or after a db reset) would otherwise have no row — a lazy
 * upsert makes that case invisible rather than a crash.
 */
export async function getSystemState(userId: string): Promise<SystemState> {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("system_state")
    .select("user_id, timezone, slammed_until, telegram_chat_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data as SystemState;

  const { data: created } = await supabase
    .from("system_state")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("user_id, timezone, slammed_until, telegram_chat_id")
    .single();

  // Seed the playbook too, so re-entry is never a blank page.
  await supabase.from("playbook").upsert(
    [
      { user_id: userId, lever: "food", label: "shake @ lunch", is_pinned: true },
      {
        user_id: userId,
        lever: "gym",
        label: "treadmill + 2 machines",
        is_pinned: true,
      },
    ],
    { onConflict: "user_id,lever,label", ignoreDuplicates: true },
  );

  return (created ?? {
    user_id: userId,
    timezone: DEFAULT_TZ,
    slammed_until: null,
    telegram_chat_id: null,
  }) as SystemState;
}

export function isSlammed(state: Pick<SystemState, "slammed_until">, today: string) {
  return state.slammed_until !== null && state.slammed_until >= today;
}

/** Everything the dashboard needs, derived in one pass. */
export async function getStatus() {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const state = await getSystemState(user.id);
  const today = logicalDate(new Date(), state.timezone);

  const [{ data: entryRows }, { data: playbookRows }, { data: milestoneRow }] =
    await Promise.all([
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
        .order("use_count", { ascending: false })
        .order("last_used_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("milestones")
        .select("kind, first_hit_on")
        .eq("user_id", user.id)
        .order("first_hit_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const entries = (entryRows ?? []) as Entry[];
  const playbook = (playbookRows ?? []) as PlaybookItem[];

  const { runs, outages } = deriveIntervals(entries, today);
  const todayEntries = entries.filter((e) => e.logged_for === today);

  // A milestone is only "live" on screen for 24h after it first landed.
  const liveMilestone =
    milestoneRow && milestoneRow.first_hit_on >= today ? milestoneRow.kind : null;

  return {
    user,
    state,
    today,
    slammed: isSlammed(state, today),
    entries,
    playbook,
    todayLevers: new Set(todayEntries.map((e) => e.lever)),
    // Sets how many steps the day-grid ramp has. See ACTIVE_LEVERS.
    leverCount: leverCount(),
    uptime: uptimeWindow(entries, today),
    run: currentRun(entries, today),
    down: downDays(entries, today),
    runs,
    outages,
    allTime: allTime(entries, today),
    lastRun: lastCompletedRun(entries, today),
    liveMilestone,
  };
}

export type Status = NonNullable<Awaited<ReturnType<typeof getStatus>>>;
