import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { loadStatus, type Status } from "./status";

/**
 * Load status, and reload it whenever the screen comes back into focus.
 *
 * Focus-refetch matters more here than in most apps: the logical day rolls at
 * 04:00, so an app resumed the next morning is showing yesterday's screen
 * until something re-derives it. Every number comes from `@uptime/core` at
 * read time, so a refetch is the only thing needed to make the whole screen
 * correct again.
 */
export function useStatus() {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await loadStatus());
      setError(null);
    } catch {
      // Says what to do, never just that it failed.
      setError("Couldn't reach the system. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { status, loading, error, refresh, setStatus };
}
