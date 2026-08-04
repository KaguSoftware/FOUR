"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, getSystemState } from "@/lib/system";
import {
  addDays,
  appendDetail,
  canAddActivity,
  canAddLever,
  findActivity,
  retireCandidate,
  logicalDate,
  normalizeActivityLabel,
  validateActivityLabel,
  uniqueLeverKey,
  validateLeverLabel,
  ACTIVITY_FULL_COPY,
  DETAIL_MAX,
  MAX_LEVERS,
  MOOD_KIND,
  MOOD_MAX,
  MOOD_MIN,
  type ActivityRow,
  type Lever,
} from "@uptime/core";

/**
 * Every action re-checks auth. Server Functions are reachable via direct POST,
 * not just through the UI, so the proxy redirect is not a security boundary.
 */
async function requireUser() {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
  return { supabase, user };
}

/**
 * What every mutating action returns.
 *
 * Most of these used to return `void` and never read Supabase's `error` at
 * all. Combined with `useOptimistic`, that made a failed write indistinguishable
 * from a successful one: the button filled in, the revalidation quietly put it
 * back, and nothing ever said why. A readout that can silently disagree with
 * the database is the one thing this product cannot ship.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Log one lever for today. Idempotent by design — the unique constraint means
 * re-tapping GYM is a no-op, not a duplicate, so a double tap on a bad
 * connection can never corrupt the day.
 */
export async function logEntry(
  lever: Lever,
  detail?: string | null,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const state = await getSystemState(user.id);
  const today = logicalDate(new Date(), state.timezone, state.day_boundary_hour);

  let playbookId: string | null = null;

  /**
   * Remember what worked — the IMPLICIT half of the activity cap.
   *
   * **Every failure here is swallowed on purpose.** The entry write below is
   * the thing that matters; this is a convenience index on top of it, and
   * `entries.detail` keeps the text regardless.
   *
   * At the cap this retires something first rather than being refused, unlike
   * `createActivity`, which refuses. The choice is `retireCandidate`'s: never
   * a pinned row, never one used more than once. If nothing qualifies it
   * creates nothing at all — the day still logs, and the playbook simply stops
   * learning until the list is pruned.
   */
  if (detail && detail.trim()) {
    const label = normalizeActivityLabel(detail);
    const { data: existing } = await supabase
      .from("playbook")
      .select("id, lever, label, use_count, last_used_at, is_pinned, archived")
      .eq("user_id", user.id)
      .eq("lever", lever)
      .eq("archived", false);

    const rows = (existing ?? []) as ActivityRow[];
    const known = findActivity(rows, label);
    const retire = retireCandidate(rows, label);
    const blocked = !known && !retire && !canAddActivity(rows.length);

    if (retire) {
      await supabase
        .from("playbook")
        .update({ archived: true })
        .eq("id", retire.id)
        .eq("user_id", user.id);
    }

    if (!blocked) {
      const { data: item } = await supabase
        .from("playbook")
        .upsert(
          { user_id: user.id, lever, label },
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
  }

  // Appended, never replaced — and capped, which the bare `text` column is
  // not. Mobile has always composed the detail this way (`log.tsx`); web
  // overwrote it, so doing the thing twice in one day lost the first half
  // depending on which client you happened to use.
  const incoming = detail?.trim() || null;
  let nextDetail = incoming ? incoming.slice(0, DETAIL_MAX) : null;

  if (incoming) {
    const { data: existing } = await supabase
      .from("entries")
      .select("detail")
      .eq("user_id", user.id)
      .eq("logged_for", today)
      .eq("lever", lever)
      .maybeSingle();

    if (existing?.detail) nextDetail = appendDetail(existing.detail, incoming);
  }

  const { error } = await supabase.from("entries").upsert(
    {
      user_id: user.id,
      logged_for: today,
      lever,
      detail: nextDetail,
      playbook_id: playbookId,
    },
    { onConflict: "user_id,logged_for,lever" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Undo today's entry for a lever. Mistakes should cost one tap to fix. */
export async function undoEntry(lever: Lever): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const state = await getSystemState(user.id);
  const today = logicalDate(new Date(), state.timezone, state.day_boundary_hour);

  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("user_id", user.id)
    .eq("logged_for", today)
    .eq("lever", lever);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Busy-season mode. Auto-expires after 14 days so it can never quietly become
 * the permanent state — re-arming is deliberate.
 */
export async function setSlammed(on: boolean): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const state = await getSystemState(user.id);
  const today = logicalDate(new Date(), state.timezone, state.day_boundary_hour);

  const { error } = await supabase
    .from("system_state")
    .update({ slammed_until: on ? addDays(today, 14) : null })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Annotate an outage after the fact — "knee", "finals". */
export async function annotateOutage(startedOn: string, note: string) {
  const { supabase, user } = await requireUser();

  await supabase
    .from("outages")
    .upsert(
      {
        user_id: user.id,
        started_on: startedOn,
        days: 0,
        note: note.trim().slice(0, 120) || null,
      },
      { onConflict: "user_id,started_on" },
    )
    .select();

  revalidatePath("/history");
}

/**
 * Today's mood reading.
 *
 * Replaces `logSignals`, which wrote up to four rows across four kinds. This
 * writes one, and the upsert on `(user_id, observed_on, kind)` means setting
 * it twice in a day REPLACES rather than appends — correct for a state
 * reading, and the reason the journal that used to share this path had to
 * append instead.
 *
 * Nothing here can affect uptime: `signals` is a different table from
 * `entries`, and only `entries` is derived from. That is a structural
 * guarantee rather than a convention.
 */
export async function saveMood(value: number): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const state = await getSystemState(user.id);
  const today = logicalDate(new Date(), state.timezone, state.day_boundary_hour);

  if (!Number.isFinite(value)) return { ok: false, error: "not a number" };
  // Clamped here as well as in core: the column's CHECK rejects anything
  // outside 1..100, and a rejected write surfaces as a constraint name rather
  // than as anything the user could act on.
  const clamped = Math.min(Math.max(Math.round(value), MOOD_MIN), MOOD_MAX);

  const { error } = await supabase.from("signals").upsert(
    {
      user_id: user.id,
      observed_on: today,
      kind: MOOD_KIND,
      value: clamped,
    },
    { onConflict: "user_id,observed_on,kind" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}

export async function setTelegramChatId(
  chatId: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  // A chat id is a numeric Telegram identifier, optionally negative for a
  // group. Anything else is a typo at best — and since every account pages
  // through one shared bot token, an unvalidated value here is a way to
  // address someone else's chat.
  const trimmed = chatId.trim();
  if (trimmed && !/^-?\d{1,20}$/.test(trimmed)) {
    return { ok: false, error: "A chat id is a number, like 123456789." };
  }

  const { error } = await supabase
    .from("system_state")
    .update({ telegram_chat_id: trimmed || null })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

/** Prove the pager works. A channel you have never seen fire is not a channel. */
export async function sendTestPage(): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requireUser();
  const state = await getSystemState(user.id);
  if (!state.telegram_chat_id) return { ok: false, error: "no chat id" };

  const { sendPage } = await import("@/lib/telegram");
  return sendPage(
    state.telegram_chat_id,
    "TEST PAGE — monitor reachable.\nthis is what a real alert looks like.",
    process.env.NEXT_PUBLIC_SITE_URL,
  );
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Levers
//
// A lever has a stable `key` and a renameable `label`. Entries store the key,
// which is what makes renaming free and archiving safe: nothing done here can
// change what a past day was worth.
// ---------------------------------------------------------------------------

export type LeverResult = { ok: true } | { ok: false; error: string };

/** Create a lever. Fails closed at four active, matching the DB constraint. */
export async function createLever(label: string): Promise<LeverResult> {
  const { supabase, user } = await requireUser();

  const check = validateLeverLabel(label);
  if (!check.ok) return { ok: false, error: check.reason };

  const { data: existing } = await supabase
    .from("levers")
    .select("key, position, archived")
    .eq("user_id", user.id);

  const rows = existing ?? [];
  const active = rows.filter((l) => !l.archived);
  if (!canAddLever(active.length)) {
    return { ok: false, error: "Four levers is the maximum. Archive one first." };
  }

  // Unique against EVERY key, archived included — an archived lever still owns
  // its key because its entries still point at it.
  const key = uniqueLeverKey(label, rows.map((l) => l.key));

  // Lowest free slot, so archiving then adding reuses the gap rather than
  // pushing past the position <= 4 constraint.
  const taken = new Set(active.map((l) => l.position));
  let position = 1;
  while (taken.has(position)) position++;

  const { error } = await supabase
    .from("levers")
    .insert({ user_id: user.id, key, label: label.trim(), position });
  if (error) return { ok: false, error: "Could not add that lever." };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Rename a lever. The key never moves, so history is untouched. */
export async function renameLever(id: string, label: string): Promise<LeverResult> {
  const { supabase, user } = await requireUser();

  const check = validateLeverLabel(label);
  if (!check.ok) return { ok: false, error: check.reason };

  const { error } = await supabase
    .from("levers")
    .update({ label: label.trim() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not rename that lever." };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Archive a lever. Never deletes.
 *
 * Entries keep pointing at the key, so the day grid and the 30-day number are
 * byte-identical afterwards — nothing you do today can make yesterday worse.
 * Refuses to archive the last one, because a dashboard with no buttons is not
 * a state the product has.
 */
export async function archiveLever(id: string): Promise<LeverResult> {
  const { supabase, user } = await requireUser();

  const { data: active } = await supabase
    .from("levers")
    .select("id")
    .eq("user_id", user.id)
    .eq("archived", false);

  if ((active ?? []).length <= 1) {
    return { ok: false, error: "Keep at least one lever — add another first." };
  }

  const { error } = await supabase
    .from("levers")
    .update({ archived: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not archive that lever." };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Finish first-run setup: write the levers, open the app.
 *
 * One action rather than a step-per-write, because a half-finished account is
 * the worst state this product can be in — the dashboard is gated behind
 * `onboarded`, so a partial run would lock the user out of their own app.
 */
export async function completeOnboarding(labels: string[]): Promise<LeverResult> {
  const { supabase, user } = await requireUser();

  const state = await getSystemState(user.id);
  // Already done. Silently succeed rather than erroring: this is what a
  // double-submit or a back-button-then-forward looks like, and neither is a
  // mistake worth showing someone.
  if (state.onboarded) return { ok: true };

  const cleaned = labels.map((l) => l.trim()).filter((l) => l.length > 0);
  if (cleaned.length === 0) {
    return { ok: false, error: "Name at least one lever — one is enough." };
  }
  if (cleaned.length > MAX_LEVERS) {
    return { ok: false, error: "Four levers is the maximum." };
  }
  for (const label of cleaned) {
    const check = validateLeverLabel(label);
    if (!check.ok) return { ok: false, error: check.reason };
  }

  // A previous attempt can leave levers behind: the insert landed, the state
  // update did not. Clearing them makes a retry exact rather than additive.
  //
  // Guarded on there being no entries, because a lever with history must never
  // be deleted — and there cannot be one here, since logging is only reachable
  // from a dashboard this screen gates. If somehow there is, the delete is
  // skipped and the insert's unique constraint is the backstop.
  const { count: entryCount } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!entryCount) {
    await supabase.from("levers").delete().eq("user_id", user.id);
  }

  const keys: string[] = [];
  const rows = cleaned.map((label, i) => {
    const key = uniqueLeverKey(label, keys);
    keys.push(key);
    return { user_id: user.id, key, label, position: i + 1 };
  });

  const { error: leverError } = await supabase.from("levers").insert(rows);
  if (leverError) {
    return { ok: false, error: "Could not save those levers. Try again." };
  }

  const { error: stateError } = await supabase
    .from("system_state")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (stateError) {
    return { ok: false, error: "Could not finish setup. Try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Bring an archived lever back, into the lowest free slot. */
export async function restoreLever(id: string): Promise<LeverResult> {
  const { supabase, user } = await requireUser();

  const { data: active } = await supabase
    .from("levers")
    .select("position")
    .eq("user_id", user.id)
    .eq("archived", false);

  const rows = active ?? [];
  if (!canAddLever(rows.length)) {
    return { ok: false, error: "Four levers is the maximum. Archive one first." };
  }

  const taken = new Set(rows.map((l) => l.position));
  let position = 1;
  while (taken.has(position)) position++;

  const { error } = await supabase
    .from("levers")
    .update({ archived: false, position })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not restore that lever." };

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Activities — the per-lever playbook
//
// Until 2026-08-03 these could only be CREATED, as a side effect of logging a
// lever with a detail. A typo lived forever, the list grew without bound
// behind a picker that showed three, and there was no way to see the rest.
//
// The cap has two halves and they are deliberately not symmetric:
//
//   - Adding HERE refuses at ten. The user is looking at the list; being told
//     it is full is an answer they can act on.
//   - `logEntry`'s implicit create never refuses, because refusing there would
//     block a log, and a missed log is a lost day. At the cap it retires
//     something provably harmless, or creates nothing at all. See
//     `retireCandidate` in core.
//
// Rules live in `packages/core/playbook.ts` so both clients enforce the same
// ones.
// ---------------------------------------------------------------------------

export async function createActivity(
  lever: Lever,
  label: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const check = validateActivityLabel(label);
  if (!check.ok) return { ok: false, error: check.reason };

  const { data: existing, error: readError } = await supabase
    .from("playbook")
    .select("id")
    .eq("user_id", user.id)
    .eq("lever", lever)
    .eq("archived", false);

  if (readError) return { ok: false, error: readError.message };
  if (!canAddActivity((existing ?? []).length)) {
    return { ok: false, error: ACTIVITY_FULL_COPY };
  }

  const { error } = await supabase.from("playbook").insert({
    user_id: user.id,
    lever,
    label: normalizeActivityLabel(label),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function renameActivity(
  id: string,
  label: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const check = validateActivityLabel(label);
  if (!check.ok) return { ok: false, error: check.reason };

  const { error } = await supabase
    .from("playbook")
    .update({ label: normalizeActivityLabel(label) })
    .eq("id", id)
    // RLS is the boundary, but the filter is this file's habit and costs
    // nothing.
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * A hard delete, and the asymmetry with levers is deliberate.
 *
 * "Archive never deletes" exists because archiving a LEVER must not change
 * uptime. An activity is a label on a shortcut chip and cannot affect it, so
 * the rule's reason does not reach here. Two things make the delete safe:
 *
 * - `entries.playbook_id` is `on delete set null (playbook_id)` and nothing in
 *   either client ever READS that column — `entries.detail` keeps the text.
 * - `unique (user_id, lever, label)` includes archived rows, so archive-only
 *   would leave a name you can neither see nor re-add, and the second attempt
 *   fails with a unique violation about an invisible row.
 *
 * The cap's own eviction still ARCHIVES: that one is the system removing
 * something the user did not ask about, and has to be recoverable.
 */
export async function deleteActivity(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("playbook")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Bring back something the cap retired. */
export async function restoreActivity(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("playbook")
    .update({ archived: false })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
