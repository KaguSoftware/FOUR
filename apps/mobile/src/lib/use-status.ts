import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";
import { createStore } from "./store";
import { loadStatus, today, type Status } from "./status";

/**
 * The status, shared by every screen.
 *
 * This is not a performance nicety — it is what makes the lever sheet usable.
 * That sheet is presented with `sheetAllowedDetents: "fitToContents"`, so iOS
 * measures its content to decide how tall to be. When the sheet fetched its own
 * data it mounted nearly empty, got measured at that height, then filled and
 * resized: a visible jolt every single time it opened.
 *
 * **It is a store, not a bare variable, and that distinction is load-bearing.**
 * It used to be `let cached` plus a `useState(cached)` in every screen, which
 * meant a `refresh()` reached the module variable and the calling screen — and
 * no other mounted screen. The focus refresh was silently covering for that:
 * every tab re-fetched on focus, so everyone converged eventually. The moment a
 * staleness guard skipped that fetch, the gap showed — Settings could write
 * `weight_enabled` and the already-mounted Proof screen would never learn.
 */
const statusStore = createStore<Status>(null);

/** When the store was last filled, and the logical day it was filled on. */
let loadedAt = 0;
let loadedDay: string | null = null;

/**
 * How long a focus refresh will trust what is already loaded.
 *
 * This is now purely about not spending a five-query round trip on every tab
 * tap. It is NOT how screens stay in sync — the store above is. Those were the
 * same mechanism once, which is why raising this number used to break things
 * that had nothing to do with staleness.
 */
const FOCUS_STALE_MS = 30_000;

/**
 * Reload from anywhere — including a screen that has no `useStatus()`.
 *
 * The native sheets need this. `add-lever` and `log` read `cachedStatus()`
 * rather than subscribing, on purpose: `fitToContents` measures their content
 * to size the sheet, so anything that arrives late makes it resize after it has
 * opened. That leaves them with no `refresh` of their own, and `add-lever` used
 * to rely on the dashboard refetching on focus to notice the new lever — which
 * quietly stopped being true the moment a staleness guard was added, and
 * presented as "adding a lever does nothing".
 *
 * Throws nothing. A caller outside a screen has nowhere to put an error, and
 * the store still holds the last good value.
 */
export async function refreshStatus(): Promise<void> {
  const next = await loadStatus();
  loadedAt = Date.now();
  loadedDay = next?.today ?? null;
  // Notifies every mounted screen.
  statusStore.set(next);
}

export function useStatus() {
  const status = useSyncExternalStore(statusStore.subscribe, statusStore.get);
  // Local, not shared. A refresh triggered from Settings should not spin the
  // dashboard's pull-to-refresh control, and an error on one screen is not
  // news the others need.
  const [loading, setLoading] = useState(statusStore.get() === null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      await refreshStatus();
      setError(null);
    } catch {
      // Says what to do, never just that it failed. The cached view stays on
      // screen underneath, which is the right answer on bad signal.
      setError("Couldn't reach the system. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (statusStore.get() === null) refresh();
  }, [refresh]);

  // Reload when a screen comes back into focus, but not on every single focus.
  //
  // The day-roll check is why this effect exists at all and is NOT part of the
  // staleness bargain: the logical day turns over at 04:00, so an app resumed
  // the next morning is showing yesterday's screen until something re-derives
  // it, however recently the data arrived. That check always wins.
  useFocusEffect(
    useCallback(() => {
      const rolled = loadedDay !== null && loadedDay !== today();
      if (rolled || Date.now() - loadedAt > FOCUS_STALE_MS) refresh();
    }, [refresh]),
  );

  return { status, loading, error, refresh };
}

/** Read the current status without subscribing — for a screen that must not refetch. */
export function cachedStatus(): Status {
  return statusStore.get();
}

/** Drop everything on sign-out, so the next account cannot inherit it. */
export function clearStatusCache() {
  statusStore.set(null);
  // Also clear the freshness stamps, or the next account's first focus sees a
  // recent timestamp and trusts data that is now gone.
  loadedAt = 0;
  loadedDay = null;
}
