import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  capped,
  enqueue,
  pending,
  settle,
  type OutboxItem,
} from "@uptime/core";
import { supabase } from "./supabase";
import { today } from "./status";

/**
 * The outbox, persisted.
 *
 * The rules live in `@uptime/core/outbox` where they are tested; this file is
 * storage and network. Tapping a lever on the subway writes here first and
 * reaches Supabase whenever it can.
 *
 * **AsyncStorage, not SecureStore.** Nothing in this queue is a credential —
 * it is which levers were tapped — and SecureStore's 2048-byte value ceiling
 * would need the same chunking the session does, for no benefit.
 *
 * The queue is per user. Two accounts on one device must never flush each
 * other's taps, so the key carries the user id.
 */

const keyFor = (userId: string) => `outbox.v1.${userId}`;

export async function readQueue(userId: string): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
  } catch {
    // A corrupt queue must not brick logging. Losing unsent taps is bad;
    // refusing to accept new ones because of them is worse.
    return [];
  }
}

async function writeQueue(userId: string, queue: OutboxItem[]) {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(capped(queue)));
}

/** Record an intent locally. Always succeeds — that is the point. */
export async function queueWrite(
  userId: string,
  lever: string,
  op: "log" | "undo",
  detail: string | null,
): Promise<OutboxItem[]> {
  const next = enqueue(await readQueue(userId), {
    logged_for: today(),
    lever,
    op,
    detail,
    queued_at: Date.now(),
  });
  await writeQueue(userId, next);
  return next;
}

/**
 * Send everything that is waiting.
 *
 * Each item is settled individually, so a flush that dies halfway keeps the
 * rest queued rather than losing them or resending what already landed. The
 * writes are idempotent — entries upsert on `(user_id, logged_for, lever)` —
 * so a retry after an ambiguous failure is an update, never a duplicate.
 *
 * Returns the queue that remains.
 */
export async function flush(userId: string): Promise<OutboxItem[]> {
  let queue = await readQueue(userId);
  if (queue.length === 0) return queue;

  for (const item of pending(queue)) {
    const ok = await send(userId, item);
    // Stop at the first failure. The rest are almost certainly going to fail
    // for the same reason, and hammering a dead connection drains the battery
    // of a phone that is already struggling for signal.
    if (!ok) break;
    queue = settle(queue, item);
    await writeQueue(userId, queue);
  }

  return queue;
}

async function send(userId: string, item: OutboxItem): Promise<boolean> {
  if (item.op === "undo") {
    const { error } = await supabase
      .from("entries")
      .delete()
      .eq("user_id", userId)
      .eq("logged_for", item.logged_for)
      .eq("lever", item.lever);
    return !error;
  }

  let playbookId: string | null = null;
  const detail = item.detail?.trim();

  if (detail) {
    const { data } = await supabase
      .from("playbook")
      .upsert(
        { user_id: userId, lever: item.lever, label: detail.slice(0, 80) },
        { onConflict: "user_id,lever,label" },
      )
      .select("id, use_count")
      .single();

    if (data) {
      playbookId = data.id;
      await supabase
        .from("playbook")
        .update({
          use_count: (data.use_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", data.id);
    }
  }

  const { error } = await supabase.from("entries").upsert(
    {
      user_id: userId,
      // The day the tap was FOR, not the day it finally sent. A tap made at
      // 23:50 that flushes the next morning still belongs to the night before.
      logged_for: item.logged_for,
      lever: item.lever,
      detail: detail || null,
      playbook_id: playbookId,
    },
    { onConflict: "user_id,logged_for,lever" },
  );

  return !error;
}
