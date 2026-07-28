import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import type { OutboxItem } from "@uptime/core";
import { flush, queueWrite, readQueue } from "./outbox";

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
export function useOutbox(userId: string | undefined, onFlushed: () => void) {
  const [queue, setQueue] = useState<OutboxItem[]>([]);
  // Guards against two flushes overlapping — a foreground event and a network
  // event often arrive together, and both would send the same item.
  const flushing = useRef(false);

  const drain = useCallback(async () => {
    if (!userId || flushing.current) return;
    flushing.current = true;
    try {
      const before = await readQueue(userId);
      if (before.length === 0) {
        setQueue(before);
        return;
      }
      const after = await flush(userId);
      setQueue(after);
      // Only reload when something actually landed, so a failed flush does not
      // spin the whole dashboard for nothing.
      if (after.length < before.length) onFlushed();
    } finally {
      flushing.current = false;
    }
  }, [userId, onFlushed]);

  useEffect(() => {
    if (!userId) return;
    readQueue(userId).then(setQueue);
    drain();

    const net = Network.addNetworkStateListener((state) => {
      if (state.isInternetReachable) drain();
    });

    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") drain();
    });

    return () => {
      net.remove();
      app.remove();
    };
  }, [userId, drain]);

  /** Queue an intent and immediately try to send it. */
  const write = useCallback(
    async (lever: string, op: "log" | "undo", detail: string | null) => {
      if (!userId) return;
      setQueue(await queueWrite(userId, lever, op, detail));
      drain();
    },
    [userId, drain],
  );

  return { queue, write, drain };
}
