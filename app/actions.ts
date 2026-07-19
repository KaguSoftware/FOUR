"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, getSystemState } from "@/lib/system";
import { addDays, logicalDate, type Lever } from "@/lib/uptime";

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

/** Weekly felt-state sample. Skippable, and it never touches uptime. */
export async function logSignals(input: {
  energy?: number | null;
  sleep?: number | null;
  detail?: string | null;
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
