import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  allTime,
  currentRun,
  deriveIntervals,
  downDays,
  lastCompletedRun,
  logicalDate,
  toPosture,
  uptimeWindow,
  ACTIVE_LEVERS,
  DEFAULT_POSTURE,
  type Entry,
  type Lever,
  type Posture,
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
  /** How the system talks to you. Never changes a number — see core/posture. */
  posture: Posture;
  /**
   * Whether first-run setup is finished. **Derived, not the raw column.**
   *
   * A database that has not run the custom-levers migration has no
   * `onboarded_at` at all, and on that database every account is onboarded —
   * there is no flow to send them to, and sending every existing user into one
   * during a deploy window is precisely the regression this guards against.
   */
  onboarded: boolean;
};

export const DEFAULT_TZ = "Europe/Istanbul";

// The lever set lives in @uptime/core so client components can read it without
// pulling next/headers into the browser bundle. Re-exported for server callers.
export { ACTIVE_LEVERS };

/**
 * Active levers, in display order.
 *
 * A **failed** read falls back to the historical pair, for the same reason the
 * weight columns do: a deploy and a migration never land at the same instant,
 * and a missing table should not take the dashboard down for the minutes in
 * between.
 *
 * An **empty** read is a different thing entirely and must not be confused with
 * it. That is a real account that has not been through onboarding, and handing
 * it two levers it never chose is exactly what onboarding exists to prevent. It
 * returns empty; `requireStatus` is what keeps that account off the dashboard.
 */
export async function getLevers(userId: string): Promise<LeverRow[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("levers")
    .select("id, key, label, position, archived")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("position", { ascending: true });

  if (error) {
    return ACTIVE_LEVERS.map((key, i) => ({
      id: `fallback-${key}`,
      key,
      label: key,
      position: i + 1,
      archived: false,
    }));
  }
  return (data ?? []) as LeverRow[];
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
const ONBOARDING_COLUMNS = "posture, onboarded_at";

/**
 * Column sets, widest first — one rung per migration that might not have landed.
 *
 * Selected optimistically and retried a rung narrower on error. Deploys and
 * migrations never land at the same instant, and a column that does not exist
 * yet should not take the whole app down for the minutes in between. The cost
 * of the fallback is one extra round trip, and only on a database that is
 * actually behind.
 */
const COLUMN_LADDER = [
  { columns: `${BASE_COLUMNS}, ${WEIGHT_COLUMNS}, ${ONBOARDING_COLUMNS}`, onboarding: true },
  { columns: `${BASE_COLUMNS}, ${WEIGHT_COLUMNS}`, onboarding: false },
  { columns: BASE_COLUMNS, onboarding: false },
] as const;

/**
 * Total, so a row from any rung of the ladder produces a complete state.
 *
 * Written out rather than spread over defaults because the raw `onboarded_at`
 * column must NOT survive into the returned object — the derived `onboarded`
 * flag is the only correct reading of it, and leaving both in invites the wrong
 * one being used.
 */
function toSystemState(
  row: Record<string, unknown>,
  hasOnboarding: boolean,
): SystemState {
  return {
    user_id: String(row.user_id),
    timezone: (row.timezone as string | null) ?? DEFAULT_TZ,
    slammed_until: (row.slammed_until as string | null) ?? null,
    telegram_chat_id: (row.telegram_chat_id as string | null) ?? null,
    weight_enabled: row.weight_enabled === true,
    weight_unit: row.weight_unit === "lb" ? "lb" : "kg",
    posture: hasOnboarding ? toPosture(row.posture) : DEFAULT_POSTURE,
    onboarded: hasOnboarding ? row.onboarded_at != null : true,
  };
}

export async function getSystemState(userId: string): Promise<SystemState> {
  const supabase = await getSupabase();

  const read = async (columns: string) =>
    supabase
      .from("system_state")
      .select(columns)
      .eq("user_id", userId)
      .maybeSingle<Record<string, unknown>>();

  let rung = 0;
  let result = await read(COLUMN_LADDER[rung].columns);
  while (result.error && rung < COLUMN_LADDER.length - 1) {
    rung++;
    result = await read(COLUMN_LADDER[rung].columns);
  }
  const { columns, onboarding } = COLUMN_LADDER[rung];

  if (result.data) return toSystemState(result.data, onboarding);

  const { data: created } = await supabase
    .from("system_state")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select(columns)
    .single();

  // No playbook seeding. It used to insert a gym and a food row here, which
  // would now VIOLATE playbook_lever_fk for any user whose levers are not that
  // pair — and after onboarding, most will not be. An empty playbook is a
  // working screen anyway: the lever sheet always offers "just mark it up".

  return toSystemState(
    (created ?? { user_id: userId }) as Record<string, unknown>,
    onboarding,
  );
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
    posture: state.posture,
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

/**
 * The gate every signed-in screen goes through — except `/onboarding` itself,
 * which would loop.
 *
 * Two redirects, in order. No session goes to sign-in; a session that has never
 * finished first-run setup goes to onboarding, because the signup trigger
 * creates `system_state` and nothing else. Without this, a fresh account lands
 * on a dashboard with no buttons on it.
 *
 * It lives here rather than in the proxy deliberately: the proxy runs on every
 * request including assets, and putting a database read there costs a round
 * trip on all of them to catch a state that exists exactly once per account.
 */
export async function requireStatus(): Promise<Status> {
  const status = await getStatus();
  if (!status) redirect("/login");
  if (!status.state.onboarded) redirect("/onboarding");
  return status;
}
