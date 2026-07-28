import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { loadStatus, type Status } from "./status";

/**
 * The last successfully loaded status, shared by every screen.
 *
 * This is not a performance nicety — it is what makes the lever sheet usable.
 * That sheet is presented with `sheetAllowedDetents: "fitToContents"`, so iOS
 * measures its content to decide how tall to be. When the sheet fetched its own
 * data it mounted nearly empty, got measured at that height, then filled and
 * resized: a visible jolt every single time it opened.
 *
 * Seeding from the cache means the sheet has its playbook on the first frame,
 * is measured once, and slides up at the right height. Tab switches stop
 * flashing empty for the same reason.
 *
 * Module-level rather than a context because it must survive a screen
 * unmounting — which is exactly what happens when the sheet is dismissed.
 */
let cached: Status = null;

export function useStatus() {
  const [status, setStatus] = useState<Status>(cached);
  // Only "loading" when there is genuinely nothing to show. A spinner over
  // data that is one second stale is worse than the stale data.
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadStatus();
      cached = next;
      setStatus(next);
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
    refresh();
  }, [refresh]);

  // Reload whenever a screen comes back into focus. This matters more here
  // than in most apps: the logical day rolls at 04:00, so an app resumed the
  // next morning is showing yesterday's screen until something re-derives it.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { status, loading, error, refresh, setStatus };
}

/** Read the cache without subscribing — for a screen that must not refetch. */
export function cachedStatus(): Status {
  return cached;
}

/** Drop the cache on sign-out, so the next account cannot inherit it. */
export function clearStatusCache() {
  cached = null;
}
