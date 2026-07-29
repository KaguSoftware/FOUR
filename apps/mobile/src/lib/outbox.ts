import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  capped,
  enqueue,
  pending,
  settle,
  type OutboxItem,
} from "@uptime/core";
import { createStore } from "./store";
import { supabase } from "./supabase";
import { today } from "./status";

/**
 * The outbox, persisted and shared.
 *
 * The rules live in `@uptime/core/outbox` where they are tested; this file is
 * storage, network, and who can see the queue. Tapping a lever on the subway
 * writes here first and reaches Supabase whenever it can.
 *
 * **The store is in memory and AsyncStorage is the backup, not the other way
 * round.** A write updates the store synchronously and persists in the
 * background, so a tap shows up on the next frame rather than after a disk
 * round trip. It also means the log SHEET and the dashboard share one queue —
 * they are separate routes with separate component trees, and the sheet used to
 * have no way to tell the dashboard anything except by writing to the server
 * and hoping the dashboard refetched.
 *
 * **AsyncStorage, not SecureStore.** Nothing in this queue is a credential —
 * it is which levers were tapped — and SecureStore's 2048-byte value ceiling
 * would need the same chunking the session does, for no benefit.
 *
 * The queue is per user. Two accounts on one device must never flush each
 * other's taps, so the key carries the user id and the store is reset on any
 * change of user.
 */

const keyFor = (userId: string) => `outbox.v1.${userId}`;

const queueStore = createStore<OutboxItem[]>([]);
/** Whose queue is in the store right now. */
let loadedFor: string | null = null;

export const outboxStore = {
  get: queueStore.get,
  subscribe: queueStore.subscribe,
};

async function readPersisted(userId: string): Promise<OutboxItem[]> {
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

/** Push the in-memory queue to disk. Never awaited by anything user-facing. */
function persist(userId: string, queue: OutboxItem[]) {
  AsyncStorage.setItem(keyFor(userId), JSON.stringify(capped(queue))).catch(
    () => {
      // Nothing useful to do. The queue is still correct in memory and will
      // flush from there; the only cost is losing it if the app is killed.
    },
  );
}

/**
 * Load this user's queue into the store.
 *
 * Idempotent per user, so the hook can call it on every mount. Switching users
 * replaces the store outright rather than merging — one account's unsent taps
 * are not the other's to send.
 */
export async function hydrate(userId: string) {
  if (loadedFor === userId) return;
  loadedFor = userId;
  queueStore.set(await readPersisted(userId));
}

/** Forget everything on sign-out. */
export function clearOutbox() {
  loadedFor = null;
  queueStore.set([]);
}

/**
 * Record an intent. Synchronous by design — this is the whole reason a tap
 * feels instant, and it is why it also works with no signal at all.
 */
export function queueWrite(
  userId: string,
  lever: string,
  op: "log" | "undo",
  detail: string | null,
): OutboxItem[] {
  const next = capped(
    enqueue(queueStore.get(), {
      logged_for: today(),
      lever,
      op,
      detail,
      queued_at: Date.now(),
    }),
  );
  queueStore.set(next);
  persist(userId, next);
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
 * Returns what remains WITHOUT publishing it to the store. The caller decides
 * when the queue may shrink, because dropping a settled item before the
 * refreshed server view has arrived puts the pre-undo state back on screen for
 * the length of a round trip. See `use-outbox.ts`.
 */
export async function flush(userId: string): Promise<OutboxItem[]> {
  let queue = queueStore.get();
  if (queue.length === 0) return queue;

  for (const item of pending(queue)) {
    const ok = await send(userId, item);
    // Stop at the first failure. The rest are almost certainly going to fail
    // for the same reason, and hammering a dead connection drains the battery
    // of a phone that is already struggling for signal.
    if (!ok) break;
    queue = settle(queue, item);
    persist(userId, queue);
  }

  return queue;
}

/** Publish a post-flush queue to every screen. */
export function commitFlushed(queue: OutboxItem[]) {
  queueStore.set(queue);
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
