import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  currentRun,
  downDays,
  evaluateFade,
  evaluatePlateau,
  hasTimeZoneSupport,
  logicalDate,
  pendingMilestones,
  pickMilestone,
  plateauText,
  uptimeWindow,
  MILESTONE_COPY,
  isPushToken,
  type Entry,
} from "@uptime/core";
import { sendPage } from "@/lib/telegram";
import { sendPush } from "@/lib/push";
import { DEFAULT_TZ } from "@/lib/system";

/**
 * Where a tapped notification lands. The app resolves `uptime://` to the
 * dashboard, which becomes the takeover on its own when down >= 3 — so the
 * page that says DOWN 4 DAYS opens on the screen for getting back up.
 */
const APP_DEEP_LINK = "uptime://";

/**
 * What to change when the signals go flat.
 *
 * These used to read "machines up one notch" / "swap the session type", which
 * assumed everyone's levers were gym sessions. Levers are user-defined, so the
 * monitor cannot know what "harder" means for this person — the same reason
 * "food first" was removed from the takeover. These two name the system's own
 * vocabulary and never the content of a goal.
 */
const PLATEAU_SUGGESTIONS = [
  "same lever, different shape",
  "swap which lever you lead with",
];

export const dynamic = "force-dynamic";

/**
 * Constant-time secret compare. Length is checked first and separately, because
 * `timingSafeEqual` throws on a length mismatch rather than returning false.
 */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type SystemStateRow = {
  user_id: string;
  timezone: string | null;
  slammed_until: string | null;
  telegram_chat_id: string | null;
  push_token: string | null;
  last_paged_on: string | null;
  last_paged_level: number | null;
  last_plateau_on: string | null;
};

type PassResult = {
  today: string;
  down: number;
  run: number;
  uptime: string;
  slammed: boolean;
  action: string;
  detail: string;
};

/**
 * One user's monitor pass.
 *
 * Extracted from the loop so a single account's failure can be caught and
 * contained by the caller. It throws freely; `GET` decides what a throw costs.
 */
async function runPass({
  supabase,
  state,
  dryRun,
  siteUrl,
}: {
  supabase: SupabaseClient;
  state: SystemStateRow;
  dryRun: boolean;
  siteUrl: string;
}): Promise<PassResult> {
  // `system_state.timezone` is user-writable and has no CHECK, and an
  // unparseable value makes `logicalDate` throw. Validate rather than trust:
  // a bad zone degrades this user to the default, instead of ending their pass.
  const zone = state.timezone ?? DEFAULT_TZ;
  const tz = hasTimeZoneSupport(zone) ? zone : DEFAULT_TZ;
  const today = logicalDate(new Date(), tz);
  const slammed = !!state.slammed_until && state.slammed_until >= today;

  const [
    { data: entryRows },
    { data: playbookRows },
    { data: fired },
    { data: signalRows },
  ] = await Promise.all([
    supabase
      .from("entries")
      .select("logged_for, lever, detail")
      .eq("user_id", state.user_id)
      .order("logged_for", { ascending: true }),
    supabase
      .from("playbook")
      .select("label, lever, is_pinned, use_count")
      .eq("user_id", state.user_id)
      .eq("archived", false)
      .order("is_pinned", { ascending: false })
      .order("use_count", { ascending: false })
      .limit(5),
    supabase.from("milestones").select("kind").eq("user_id", state.user_id),
    supabase
      .from("signals")
      .select("observed_on, kind, value")
      .eq("user_id", state.user_id)
      .not("value", "is", null)
      .order("observed_on", { ascending: true }),
  ]);

  const entries = (entryRows ?? []) as Entry[];
  const down = downDays(entries, today);
  const run = currentRun(entries, today);
  const { up, total } = uptimeWindow(entries, today);
  const uptimePct = total ? (up / total) * 100 : 0;

  // Ranked by what has actually worked — pinned first, then use_count, per
  // the query above. This used to put the food lever first, on the principle
  // that coming back must be lighter than starting; that cannot survive
  // user-defined levers, since we have no way to know which of someone's
  // levers is the light one. See takeover.tsx.
  const playbook = (playbookRows ?? []).map((p) => p.label);

  /**
   * Deliver one page over whichever channel this account has.
   *
   * Push first — it is the real channel now. Telegram stays as a fallback
   * through the transition and disappears once every account carries a
   * token; `monitor.ts` never learns which one it is talking to, so the
   * escalation ladder is untouched by any of this.
   *
   * Returns a human-readable suffix for the `monitor_runs` row rather than
   * throwing. "Why didn't it page me" must always have an answer, and
   * "the token was dead" is one of the answers worth recording.
   */
  const deliver = async (text: string): Promise<string> => {
    if (isPushToken(state.push_token)) {
      const result = await sendPush(state.push_token, text, APP_DEEP_LINK);
      if (result.ok) return "";

      if (result.deviceUnregistered) {
        // The app was uninstalled or the OS rotated the token. Clearing it
        // stops every later pass retrying something that can never succeed.
        await supabase
          .from("system_state")
          .update({ push_token: null, push_platform: null })
          .eq("user_id", state.user_id);
      }

      // Fall through to Telegram if it is still configured, so a transient
      // push failure does not swallow the page entirely.
      if (!state.telegram_chat_id) return ` (push failed: ${result.error})`;
      const sent = await sendPage(state.telegram_chat_id, text, siteUrl);
      return sent.ok
        ? " (push failed; sent via telegram)"
        : ` (push and telegram both failed: ${result.error})`;
    }

    if (state.telegram_chat_id) {
      const sent = await sendPage(state.telegram_chat_id, text, siteUrl);
      return sent.ok ? "" : ` (send failed: ${sent.error})`;
    }

    return " (no channel; not delivered)";
  };

  let action = "none";
  let detail = "";

  // --- 1. the fade ----------------------------------------------------------
  const fade = evaluateFade({
    down,
    slammed,
    today,
    lastPagedOn: state.last_paged_on,
    lastPagedLevel: state.last_paged_level,
    topPlaybook: playbook,
  });

  if (fade.kind === "page") {
    action = `page:L${fade.level}`;
    detail = fade.text.split("\n")[0];

    if (!dryRun) {
      detail += await deliver(fade.text);

      // Record the decision regardless of delivery. If this only ran on a
      // successful send, an unconfigured or failing channel would re-page
      // every pass — and the dedupe guard must not depend on a side effect.
      await supabase
        .from("system_state")
        .update({ last_paged_on: today, last_paged_level: fade.level })
        .eq("user_id", state.user_id);
    }
  } else {
    detail = fade.reason;

    // --- 2. milestones ------------------------------------------------------
    const alreadyFired = new Set((fired ?? []).map((m) => m.kind));
    const pending = pendingMilestones({ entries, today, alreadyFired });
    const pick = pickMilestone(pending);

    if (pick) {
      action = `milestone:${pick}`;
      // Every reached threshold is recorded, but only the highest is sent —
      // the rest are marked seen so they never fire late.
      const rows = pending.map((kind) => ({
        user_id: state.user_id,
        kind,
        first_hit_on: today,
        notified_at: kind === pick ? new Date().toISOString() : null,
      }));
      if (!dryRun) {
        await supabase
          .from("milestones")
          .upsert(rows, { onConflict: "user_id,kind", ignoreDuplicates: true });

        await deliver(
          `${MILESTONE_COPY[pick].toUpperCase()}\nuptime ${up}/${total}`,
        );
      }
      detail = `run ${run}d, uptime ${up}/${total}`;
    } else {
      // --- 3. the plateau ---------------------------------------------------
      const plateau = evaluatePlateau({
        signals: signalRows ?? [],
        uptimePct,
        today,
        lastPlateauOn: state.last_plateau_on,
      });

      if (plateau.flat) {
        action = "plateau";
        detail = plateau.reason;
        const weekNo = Math.max(1, Math.ceil(run / 7));
        const text = plateauText(weekNo, PLATEAU_SUGGESTIONS);
        if (!dryRun) {
          detail += await deliver(text);
          // Recorded regardless of delivery, for the same reason the fade
          // dedupe is: a guard that depends on a side effect re-fires
          // forever against an unconfigured channel.
          await supabase
            .from("system_state")
            .update({ last_plateau_on: today })
            .eq("user_id", state.user_id);
        }
      }
    }
  }

  if (!dryRun) {
    await supabase.from("monitor_runs").insert({
      user_id: state.user_id,
      ran_on: today,
      down_days: down,
      action,
      detail,
    });
  }

  return {
    today,
    down,
    run,
    uptime: `${up}/${total}`,
    slammed,
    action,
    detail,
  };
}

/**
 * The monitor pass. Runs daily via Vercel Cron.
 *
 * This route is the reason the app exists, so it is built to be debuggable
 * rather than clever: every pass writes a row to `monitor_runs` with what it
 * saw and what it did. "Why didn't it page me" must always have an answer.
 *
 * Uses the service role key because it runs without a user session. That key
 * bypasses RLS, so the route authenticates with CRON_SECRET and is excluded
 * from the proxy matcher.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Header only. The secret used to be accepted as `?secret=` too, which put it
  // in Vercel's access logs, in any proxy log in front of them, and in the
  // Referer of anything a page might link to. Vercel Cron sends the
  // Authorization header, so nothing legitimate needed the query form.
  const auth = request.headers.get("authorization");
  const provided = auth ? auth.replace(/^Bearer\s+/i, "") : null;

  if (!secret || !secretMatches(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 500 },
    );
  }

  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

  const { data: states } = await supabase
    .from("system_state")
    .select(
      "user_id, timezone, slammed_until, telegram_chat_id, push_token, last_paged_on, last_paged_level, last_plateau_on",
    );

  const results: PassResult[] = [];
  const failures: { user: string; error: string }[] = [];

  for (const state of (states ?? []) as SystemStateRow[]) {
    try {
      results.push(await runPass({ supabase, state, dryRun, siteUrl }));
    } catch (err) {
      // One account's pass failing must never cost anyone else theirs. Before
      // this existed, a single unparseable timezone threw here and every user
      // after it in the list was silently never evaluated — the pager failing
      // closed, for everyone, because of one person's bad row.
      failures.push({
        user: state.user_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // `results` deliberately carries no user ids. This endpoint reports on every
  // account in the system, so echoing them turned a leaked CRON_SECRET into
  // user enumeration plus a per-user activity dump. Failures keep the id,
  // because a failure you cannot attribute is not actionable — and they are
  // the rare case rather than a full listing.
  return NextResponse.json({
    ok: true,
    dryRun,
    checked: results.length,
    failed: failures.length,
    results,
    ...(failures.length ? { failures } : {}),
  });
}
