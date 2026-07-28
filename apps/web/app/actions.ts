"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, getSystemState } from "@/lib/system";
import {
  addDays,
  canAddLever,
  logicalDate,
  toPosture,
  uniqueLeverKey,
  validateLeverLabel,
  MAX_LEVERS,
  type Lever,
  type Posture,
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
 * Log one lever for today. Idempotent by design — the unique constraint means
 * re-tapping GYM is a no-op, not a duplicate, so a double tap on a bad
 * connection can never corrupt the day.
 */
export async function logEntry(lever: Lever, detail?: string | null) {
  const { supabase, user } = await requireUser();
  const state = await getSystemState(user.id);
  const today = logicalDate(new Date(), state.timezone);

  let playbookId: string | null = null;

  if (detail && detail.trim()) {
    const label = detail.trim().slice(0, 80);
    // Upsert into the playbook so what worked is always one tap next time.
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

  await supabase.from("entries").upsert(
    {
      user_id: user.id,
      logged_for: today,
      lever,
      detail: detail?.trim() || null,
      playbook_id: playbookId,
    },
    { onConflict: "user_id,logged_for,lever" },
  );

  revalidatePath("/", "layout");
}

/** Undo today's entry for a lever. Mistakes should cost one tap to fix. */
export async function undoEntry(lever: Lever) {
  const { supabase, user } = await requireUser();
  const state = await getSystemState(user.id);
  const today = logicalDate(new Date(), state.timezone);

  await supabase
    .from("entries")
    .delete()
    .eq("user_id", user.id)
    .eq("logged_for", today)
    .eq("lever", lever);

  revalidatePath("/", "layout");
}

/**
 * Busy-season mode. Auto-expires after 14 days so it can never quietly become
 * the permanent state — re-arming is deliberate.
 */
export async function setSlammed(on: boolean) {
  const { supabase, user } = await requireUser();
  const state = await getSystemState(user.id);
  const today = logicalDate(new Date(), state.timezone);

  await supabase
    .from("system_state")
    .update({ slammed_until: on ? addDays(today, 14) : null })
    .eq("user_id", user.id);

  revalidatePath("/", "layout");
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

export async function updatePlaybook(
  id: string,
  patch: { label?: string; is_pinned?: boolean; archived?: boolean },
) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("playbook")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/", "layout");
}

/** Daily felt-state sample. Skippable, and it never touches uptime. */
export async function logSignals(input: {
  energy?: number | null;
  sleep?: number | null;
  detail?: string | null;
  /** Optional, opt-in. Stored in `signals`, never in `entries`, so it is
      structurally incapable of affecting uptime. */
  weight?: number | null;
}) {
  const { supabase, user } = await requireUser();
  const state = await getSystemState(user.id);
  const today = logicalDate(new Date(), state.timezone);

  const rows = [];
  if (input.energy)
    rows.push({
      user_id: user.id,
      observed_on: today,
      kind: "energy",
      value: input.energy,
    });
  if (input.sleep)
    rows.push({
      user_id: user.id,
      observed_on: today,
      kind: "sleep",
      value: input.sleep,
    });
  if (input.detail?.trim())
    rows.push({
      user_id: user.id,
      observed_on: today,
      kind: "note",
      value: null,
      detail: input.detail.trim().slice(0, 160),
    });

  // Only recorded when the feature is on, so a stale client cannot write
  // weight into an account that never enabled it.
  if (state.weight_enabled && input.weight != null && Number.isFinite(input.weight)) {
    const amount = Math.round(Math.min(Math.max(input.weight, 1), 999) * 100) / 100;
    rows.push({
      user_id: user.id,
      observed_on: today,
      kind: "weight",
      value: null,
      amount,
    });
  }

  if (rows.length) {
    await supabase
      .from("signals")
      .upsert(rows, { onConflict: "user_id,observed_on,kind" });
  }

  revalidatePath("/proof");
  revalidatePath("/");
}

export async function setTelegramChatId(chatId: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("system_state")
    .update({ telegram_chat_id: chatId.trim() || null })
    .eq("user_id", user.id);
  revalidatePath("/settings");
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

/**
 * The weight opt-in.
 *
 * Switching it off hides the field and the chart but deletes nothing, so
 * switching back on restores the history rather than starting from zero.
 */
export async function setWeightEnabled(on: boolean) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("system_state")
    .update({ weight_enabled: on })
    .eq("user_id", user.id);
  revalidatePath("/settings");
  revalidatePath("/proof");
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
 * Finish first-run setup: write the levers, record the posture, open the app.
 *
 * One action rather than a step-per-write, because a half-finished account is
 * the worst state this product can be in — the dashboard is gated behind
 * `onboarded`, so a partial run would lock the user out of their own app.
 */
export async function completeOnboarding(
  labels: string[],
  posture: Posture,
): Promise<LeverResult> {
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
    .update({ posture: toPosture(posture), onboarded_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (stateError) {
    return { ok: false, error: "Could not finish setup. Try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Change posture later. Promised on the onboarding screen ("change it any time
 * in Settings"), so it is part of that screen's contract, not a nice-to-have.
 */
export async function setPosture(posture: Posture): Promise<LeverResult> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("system_state")
    .update({ posture: toPosture(posture) })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not change that." };

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
