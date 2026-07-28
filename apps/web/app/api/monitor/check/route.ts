import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  currentRun,
  downDays,
  evaluateFade,
  evaluatePlateau,
  logicalDate,
  pendingMilestones,
  pickMilestone,
  plateauText,
  uptimeWindow,
  MILESTONE_COPY,
  type Entry,
} from "@uptime/core";
import { sendPage } from "@/lib/telegram";
import { DEFAULT_TZ } from "@/lib/system";

export const dynamic = "force-dynamic";

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
  const auth = request.headers.get("authorization");
  const provided = auth?.replace(/^Bearer\s+/i, "") ??
    request.nextUrl.searchParams.get("secret");

  if (!secret || provided !== secret) {
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

  const { data: states } = await supabase
    .from("system_state")
    .select("user_id, timezone, slammed_until, telegram_chat_id, last_paged_on, last_paged_level, last_plateau_on");

  const results = [];

  for (const state of states ?? []) {
    const today = logicalDate(new Date(), state.timezone ?? DEFAULT_TZ);
    const slammed =
      !!state.slammed_until && state.slammed_until >= today;

    const [{ data: entryRows }, { data: playbookRows }, { data: fired }, { data: signalRows }] =
      await Promise.all([
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

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

    let action = "none";
    let detail = "";

    // --- 1. the fade ------------------------------------------------------
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
        if (state.telegram_chat_id) {
          const sent = await sendPage(state.telegram_chat_id, fade.text, siteUrl);
          if (!sent.ok) detail += ` (send failed: ${sent.error})`;
        } else {
          detail += " (no chat id; not delivered)";
        }

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

      // --- 2. milestones -------------------------------------------------
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

          if (state.telegram_chat_id) {
            const text = `${MILESTONE_COPY[pick].toUpperCase()}\nuptime ${up}/${total}`;
            await sendPage(state.telegram_chat_id, text);
          }
        }
        detail = `run ${run}d, uptime ${up}/${total}`;
      } else {
        // --- 3. the plateau ---------------------------------------------
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
          const text = plateauText(weekNo, [
            "machines up one notch",
            "swap the session type",
          ]);
          if (!dryRun && state.telegram_chat_id) {
            await sendPage(state.telegram_chat_id, text, siteUrl);
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

    results.push({
      user: state.user_id,
      today,
      down,
      run,
      uptime: `${up}/${total}`,
      slammed,
      action,
      detail,
    });
  }

  return NextResponse.json({ ok: true, dryRun, results });
}
