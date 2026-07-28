import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  allTime,
  currentRun,
  deriveIntervals,
  downDays,
  lastCompletedRun,
  logicalDate,
  uptimeWindow,
  ACTIVE_LEVERS,
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

export type LeverRow = {
  id: string;
  key: string;
  label: string;
  position: number;
  archived: boolean;
};

export type SystemState = {
  user_id: string;
  timezone: string;
  slammed_until: string | null;
  telegram_chat_id: string | null;
  weight_enabled: boolean;
  weight_unit: "kg" | "lb";
};

export const DEFAULT_TZ = "Europe/Istanbul";

// The lever set lives in @uptime/core so client components can read it without
// pulling next/headers into the browser bundle. Re-exported for server callers.
export { ACTIVE_LEVERS };

/**
 * Active levers, in display order.
 *
 * Falls back to the historical pair if the `levers` table is not there yet,
 * for the same reason the weight columns do: a deploy and a migration never
 * land at the same instant, and a missing table should not take the dashboard
 * down for the minutes in between.
 */
export async function getLevers(userId: string): Promise<LeverRow[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("levers")
    .select("id, key, label, position, archived")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("position", { ascending: true });

  if (error || !data || data.length === 0) {
    return ACTIVE_LEVERS.map((key, i) => ({
      id: `fallback-${key}`,
      key,
      label: key,
      position: i + 1,
      archived: false,
    }));
  }
  return data as LeverRow[];
}

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
const BASE_COLUMNS = "user_id, timezone, slammed_until, telegram_chat_id";
const WEIGHT_COLUMNS = "weight_enabled, weight_unit";

/** Defaults for a database that has not run the optional-weight migration. */
const WEIGHT_DEFAULTS = { weight_enabled: false, weight_unit: "kg" as const };

export async function getSystemState(userId: string): Promise<SystemState> {
  const supabase = await getSupabase();

  // Selected optimistically, then retried without the weight columns if they
  // are not there. Deploys and migrations do not land at the same instant, and
  // a column that does not exist yet should not take the whole app down for
  // the minutes in between.
  const read = async (columns: string) =>
    supabase
      .from("system_state")
      .select(columns)
      .eq("user_id", userId)
      .maybeSingle<Record<string, unknown>>();

  const full = await read(`${BASE_COLUMNS}, ${WEIGHT_COLUMNS}`);
  const migrated = !full.error;
  const row = migrated ? full.data : (await read(BASE_COLUMNS)).data;

  if (row) {
    // Defaults first so a pre-migration row still satisfies the type; a
    // migrated row overrides them with its real values.
    return { ...WEIGHT_DEFAULTS, ...row } as unknown as SystemState;
  }

  const { data: created } = await supabase
    .from("system_state")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select(migrated ? `${BASE_COLUMNS}, ${WEIGHT_COLUMNS}` : BASE_COLUMNS)
    .single();

  // No playbook seeding. It used to insert a gym and a food row here, which
  // would now VIOLATE playbook_lever_fk for any user whose levers are not that
  // pair — and after onboarding, most will not be. An empty playbook is a
  // working screen anyway: the lever sheet always offers "just mark it up".

  const createdRow = (created ?? {
    user_id: userId,
    timezone: DEFAULT_TZ,
    slammed_until: null,
    telegram_chat_id: null,
  }) as Record<string, unknown>;

  return { ...WEIGHT_DEFAULTS, ...createdRow } as unknown as SystemState;
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

  const [{ data: entryRows }, { data: playbookRows }, { data: milestoneRow }, levers] =
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
      getLevers(user.id),
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
    levers,
    // Sets how many steps the day-grid ramp has.
    leverCount: levers.length,
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
