import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  canAddActivity,
  capped,
  enqueue,
  findActivity,
  normalizeActivityLabel,
  pending,
  retireCandidate,
  settle,
  splitDetail,
  OUTBOX_MAX,
  type ActivityRow,
  type OutboxItem,
} from "@uptime/core";
import { createStore } from "./store";
import { supabase } from "./supabase";
import { currentBoundaryHour, today } from "./status";

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
const healthKeyFor = (userId: string) => `outbox.health.v1.${userId}`;

/**
 * A tap the server refused for a reason retrying cannot fix.
 *
 * Kept rather than discarded. A dropped log is a day the user believes is up
 * and is not, and quietly losing one is the precise failure this product
 * exists to prevent — so it leaves the send queue (where it would block
 * everything behind it) and lands here, where a screen can show it.
 */
export type BlockedItem = OutboxItem & { reason: string };

export type OutboxHealth = {
  blocked: BlockedItem[];
  /** Taps evicted by the {@link OUTBOX_MAX} cap, which is silent otherwise. */
  dropped: number;
};

const NO_HEALTH: OutboxHealth = { blocked: [], dropped: 0 };

const queueStore = createStore<OutboxItem[]>([]);
const healthStore = createStore<OutboxHealth>(NO_HEALTH);

/** Whose queue is in the store right now. */
let loadedFor: string | null = null;
/** In-flight hydration, so two concurrent callers share one disk read. */
let hydratingFor: string | null = null;
let hydration: Promise<void> | null = null;

export const outboxStore = {
  get: queueStore.get,
  subscribe: queueStore.subscribe,
};

/** Trouble worth showing a user: refused taps, and taps lost to the cap. */
export const outboxHealthStore = {
  get: healthStore.get,
  subscribe: healthStore.subscribe,
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // A corrupt queue must not brick logging. Losing unsent taps is bad;
    // refusing to accept new ones because of them is worse.
    return fallback;
  }
}

async function readPersisted(userId: string): Promise<OutboxItem[]> {
  const parsed = await readJson<OutboxItem[]>(keyFor(userId), []);
  return Array.isArray(parsed) ? parsed : [];
}

async function readHealth(userId: string): Promise<OutboxHealth> {
  const parsed = await readJson<OutboxHealth>(healthKeyFor(userId), NO_HEALTH);
  return {
    blocked: Array.isArray(parsed?.blocked) ? parsed.blocked : [],
    dropped: Number.isFinite(parsed?.dropped) ? parsed.dropped : 0,
  };
}

/** Push the in-memory queue to disk. Never awaited by anything user-facing. */
function persist(userId: string, queue: OutboxItem[]) {
  AsyncStorage.setItem(keyFor(userId), JSON.stringify(queue)).catch(() => {
    // Nothing useful to do. The queue is still correct in memory and will
    // flush from there; the only cost is losing it if the app is killed.
  });
}

function persistHealth(userId: string, health: OutboxHealth) {
  healthStore.set(health);
  AsyncStorage.setItem(healthKeyFor(userId), JSON.stringify(health)).catch(
    () => {},
  );
}

/**
 * Load this user's queue into the store.
 *
 * Idempotent per user, so the hook can call it on every mount. Switching users
 * replaces the store outright rather than merging — one account's unsent taps
 * are not the other's to send.
 *
 * `loadedFor` is set only once the read has landed. It used to be set first,
 * so a second caller arriving mid-read returned immediately and believed an
 * empty store was this user's real queue.
 */
export async function hydrate(userId: string): Promise<void> {
  if (loadedFor === userId) return;
  if (hydratingFor === userId && hydration) return hydration;

  hydratingFor = userId;
  hydration = (async () => {
    const [queue, health] = await Promise.all([
      readPersisted(userId),
      readHealth(userId),
    ]);
    // A user switch during the read wins; this result is stale.
    if (hydratingFor !== userId) return;
    queueStore.set(queue);
    healthStore.set(health);
    loadedFor = userId;
  })();

  return hydration;
}

/**
 * Forget everything on sign-out.
 *
 * Deletes the persisted copies too. Leaving them behind meant a signed-out —
 * or deleted — account's taps stayed readable on disk indefinitely, and would
 * be flushed the moment that user id signed in again on this device.
 */
export async function clearOutbox(): Promise<void> {
  const userId = loadedFor ?? hydratingFor;
  loadedFor = null;
  hydratingFor = null;
  hydration = null;
  queueStore.set([]);
  healthStore.set(NO_HEALTH);

  if (!userId) return;
  try {
    await AsyncStorage.multiRemove([keyFor(userId), healthKeyFor(userId)]);
  } catch {
    // Best effort. The stores are already empty, so nothing is shown or sent.
  }
}

/** Discard refused taps once the user has seen them. */
export function clearBlocked(userId: string) {
  persistHealth(userId, { ...healthStore.get(), blocked: [], dropped: 0 });
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
  const grown = enqueue(queueStore.get(), {
    logged_for: today(),
    lever,
    op,
    detail,
    queued_at: Date.now(),
  });
  const next = capped(grown);

  // The cap drops the oldest intents silently. Counting them is the only way
  // the user can ever learn that a tap they made is never going to arrive.
  if (next.length < grown.length) {
    const health = healthStore.get();
    persistHealth(userId, {
      ...health,
      dropped: health.dropped + (grown.length - next.length),
    });
  }

  queueStore.set(next);
  persist(userId, next);
  return next;
}

/**
 * Why a write failed, and whether trying again could ever help.
 *
 * Postgres reports constraint and permission failures with a SQLSTATE. Those
 * describe the request, not the connection: an RLS denial or a foreign key
 * violation will fail identically forever, so retrying one is an infinite
 * loop. Anything else — no signal, a timeout, a 5xx — is worth retrying.
 */
const PERMANENT_SQLSTATE = /^(22|23|42)/;

function isPermanent(error: { code?: string | null } | null): boolean {
  return !!error?.code && PERMANENT_SQLSTATE.test(error.code);
}

type SendResult =
  | { ok: true }
  | { ok: false; permanent: boolean; reason: string };

/**
 * Send everything that is waiting.
 *
 * Each item is settled individually, so a flush that dies halfway keeps the
 * rest queued rather than losing them or resending what already landed. The
 * writes are idempotent — entries upsert on `(user_id, logged_for, lever)` —
 * so a retry after an ambiguous failure is an update, never a duplicate.
 *
 * A **transient** failure stops the pass: the rest are almost certainly going
 * to fail for the same reason, and hammering a dead connection drains the
 * battery of a phone already struggling for signal. A **permanent** failure
 * moves that one item aside and the pass continues — before this split, a
 * single unsendable tap sat at the head of the queue and blocked every later
 * one forever, with nothing on screen to say so.
 *
 * Returns what remains WITHOUT publishing it to the store. The caller decides
 * when the queue may shrink, because dropping a settled item before the
 * refreshed server view has arrived puts the pre-undo state back on screen for
 * the length of a round trip. See `use-outbox.ts`.
 */
export async function flush(userId: string): Promise<OutboxItem[]> {
  let queue = queueStore.get();
  if (queue.length === 0) return queue;

  const blocked: BlockedItem[] = [];

  for (const item of pending(queue)) {
    const result = await send(userId, item);

    if (!result.ok && !result.permanent) break;

    if (!result.ok) blocked.push({ ...item, reason: result.reason });

    queue = settle(queue, item);
    persist(userId, queue);
  }

  if (blocked.length) {
    const health = healthStore.get();
    persistHealth(userId, {
      ...health,
      blocked: [...health.blocked, ...blocked].slice(-OUTBOX_MAX),
    });
  }

  return queue;
}

/** Publish a post-flush queue to every screen. */
export function commitFlushed(queue: OutboxItem[]) {
  queueStore.set(queue);
}

async function send(userId: string, item: OutboxItem): Promise<SendResult> {
  if (item.op === "undo") {
    const { error } = await supabase
      .from("entries")
      .delete()
      .eq("user_id", userId)
      .eq("logged_for", item.logged_for)
      .eq("lever", item.lever);
    if (error) {
      return { ok: false, permanent: isPermanent(error), reason: error.message };
    }
    // Take the day's actions with it. There is no foreign key from `actions` to
    // `entries` to cascade this — the two are joined on (user, day, lever), not
    // by id — so un-logging a lever has to clear both or the day sheet keeps
    // listing things done on a day that no longer records them.
    await syncActions(userId, item.logged_for, item.lever, null);
    return { ok: true };
  }

  let playbookId: string | null = null;
  const detail = item.detail?.trim();

  /**
   * Remember what worked — the IMPLICIT half of the activity cap.
   *
   * **Every failure here is swallowed on purpose.** The entry write below is
   * the thing that matters; this is a convenience index on top of it, and
   * `entries.detail` keeps the text regardless. A playbook write that fails
   * must never turn a logged day into a lost one.
   *
   * At the cap this retires something first rather than being refused. The
   * choice is `retireCandidate`'s: never a pinned row, never one used more
   * than once. If nothing qualifies it creates nothing at all — the day still
   * logs, and the playbook simply stops learning until the list is pruned.
   *
   * The database has its own cap trigger as a backstop, which archives rather
   * than raising for exactly the same reason. Retiring the chosen row here
   * first means the trigger finds room and does not have to pick for itself.
   */
  if (detail) {
    const label = normalizeActivityLabel(detail);
    const { data: existing } = await supabase
      .from("playbook")
      .select("id, lever, label, use_count, last_used_at, is_pinned, archived")
      .eq("user_id", userId)
      .eq("lever", item.lever)
      .eq("archived", false);

    const rows = (existing ?? []) as ActivityRow[];
    const known = findActivity(rows, label);
    const retire = retireCandidate(rows, label);
    // At the cap with nothing safe to evict: skip the playbook entirely. The
    // entry still carries the full detail.
    const blocked = !known && !retire && !canAddActivity(rows.length);

    if (retire) {
      await supabase
        .from("playbook")
        .update({ archived: true })
        .eq("id", retire.id)
        .eq("user_id", userId);
    }

    if (!blocked) {
      const { data } = await supabase
        .from("playbook")
        .upsert(
          { user_id: userId, lever: item.lever, label },
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
  }

  const { error } = await supabase.from("entries").upsert(
    {
      user_id: userId,
      // The day the tap was FOR, not the day it finally sent. A tap made at
      // 23:50 that flushes the next morning still belongs to the night before.
      logged_for: item.logged_for,
      lever: item.lever,
      // Still written, and still the joined string. A shipped build reads this
      // column and knows nothing about `actions`, so it stays the record of
      // record until no installed client depends on it. See the migration.
      detail: detail || null,
      playbook_id: playbookId,
      // Which boundary filed this day, recorded so the row explains itself
      // later. Nothing derives uptime from it — `logged_for` is still the only
      // date any reader keys off — but it is what makes changing the setting
      // safe: history keeps the rule it was written under instead of being
      // silently re-dated. See the day-boundary migration.
      boundary_hour: currentBoundaryHour(),
    },
    { onConflict: "user_id,logged_for,lever" },
  );

  if (error) {
    return { ok: false, permanent: isPermanent(error), reason: error.message };
  }

  await syncActions(userId, item.logged_for, item.lever, detail || null);
  return { ok: true };
}

/**
 * Mirror a day's detail into `actions`, one row per thing done.
 *
 * **Runs AFTER the entry write, and every failure is swallowed.** Same doctrine
 * as the playbook block above, and for a stronger reason: the entry is what
 * makes the day up, `entries.detail` already holds the full text, and this
 * table is a structured view of it. A failure here must never turn a logged day
 * into a lost one — that is the single failure this product exists to prevent,
 * and it is why the split went into a child table instead of widening the
 * entries key.
 *
 * Derived from the joined string rather than from the tap, so it cannot drift
 * from `entries.detail`: whatever that column ends up holding is exactly what
 * this reproduces, including a detail written by an older build.
 *
 * Delete-then-insert rather than a diff. A day holds a handful of actions, the
 * write is idempotent — which is what makes a replayed outbox item safe — and
 * the alternative is reconciling two lists to save one round trip.
 */
async function syncActions(
  userId: string,
  loggedFor: string,
  lever: string,
  detail: string | null,
): Promise<void> {
  try {
    await supabase
      .from("actions")
      .delete()
      .eq("user_id", userId)
      .eq("logged_for", loggedFor)
      .eq("lever", lever);

    const labels = splitDetail(detail);
    if (labels.length === 0) return;

    await supabase.from("actions").insert(
      labels.map((label, i) => ({
        user_id: userId,
        logged_for: loggedFor,
        lever,
        label,
        // Order within the day, not a clock time — actions carry no timestamp.
        position: i + 1,
      })),
    );
  } catch {
    // Deliberately silent. See the docblock.
  }
}
