import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import {
  commitFlushed,
  flush,
  hydrate,
  outboxStore,
  queueWrite,
} from "./outbox";

/**
 * The outbox, wired to the things that mean "try again".
 *
 * Three triggers, because no single one is reliable on a phone:
 *   - **coming back online**, the obvious one;
 *   - **returning to the foreground**, which catches a connection that
 *     recovered while the app was suspended and fired no event;
 *   - **every write**, so a queue that formed offline drains the moment the
 *     next tap happens to land.
 *
 * A flush is never awaited by the UI. The tap already counted locally; making
 * someone watch a spinner for a write they cannot influence is the friction
 * this product exists to remove.
 */
export function useOutbox(
  userId: string | undefined,
  onFlushed: () => void | Promise<void>,
) {
  const queue = useSyncExternalStore(outboxStore.subscribe, outboxStore.get);
  // Guards against two flushes overlapping — a foreground event and a network
  // event often arrive together, and both would send the same item.
  const flushing = useRef(false);

  const drain = useCallback(async () => {
    if (!userId || flushing.current) return;
    flushing.current = true;
    try {
      const before = outboxStore.get();
      if (before.length === 0) return;

      const after = await flush(userId);

      // **Reload BEFORE publishing the shrunken queue.**
      //
      // The queue is an overlay on the server's view (`applyToDay`). Dropping a
      // settled item first leaves the screen reading a `todayLevers` the server
      // has not re-sent yet — so an undo would land, then the lever would pop
      // back for the length of the round trip, then vanish again when the
      // reload finally arrived. Three state changes for one tap.
      //
      // Holding the overlay until the truth has actually landed makes the two
      // agree at the moment of the swap, so nothing visibly changes twice.
      if (after.length < before.length) await onFlushed();
      commitFlushed(after);
    } finally {
      flushing.current = false;
    }
  }, [userId, onFlushed]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    hydrate(userId).then(() => {
      if (!cancelled) drain();
    });

    const net = Network.addNetworkStateListener((state) => {
      if (state.isInternetReachable) drain();
    });

    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") drain();
    });

    return () => {
      cancelled = true;
      net.remove();
      app.remove();
    };
  }, [userId, drain]);

  // Anything in the queue is something to try sending, wherever it came from.
  //
  // This is what covers writes made outside this hook — the log sheet is its
  // own route with its own component tree, so it queues into the shared store
  // and has nobody to call `drain()` on. Without this its taps would show
  // instantly and then sit unsent until the app happened to background or the
  // network blinked.
  //
  // It cannot spin: a flush that sends nothing returns the identical array, and
  // the store suppresses a set to a value it already holds, so no notification
  // and no re-run.
  useEffect(() => {
    if (queue.length > 0) drain();
  }, [queue, drain]);

  /**
   * Queue an intent and try to send it.
   *
   * The queue write is synchronous, so the caller's next render already shows
   * the tap. Sending is what happens afterwards, whenever it can.
   */
  const write = useCallback(
    (lever: string, op: "log" | "undo", detail: string | null) => {
      if (!userId) return;
      queueWrite(userId, lever, op, detail);
      drain();
    },
    [userId, drain],
  );

  return { queue, write, drain };
}
