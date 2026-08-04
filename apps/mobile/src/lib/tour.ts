import AsyncStorage from "@react-native-async-storage/async-storage";

import { createStore } from "./store";

/**
 * Whether this device has run the first-open tour.
 *
 * Device-local on purpose, same key shape as the outbox. `system_state` would
 * sync the flag across devices, but "has this PERSON been taught" is not the
 * question — a new phone deserves the tour once even for an old account, and a
 * reinstall re-running five spotlight steps costs nothing. The web app has no
 * tour, so a server column would be a promise only one client keeps.
 *
 * Keyed per user so a shared device teaches each account once, not the first
 * account only.
 *
 * The key is `tour.v1`, not the old `walkthrough.v1`: the written manual was
 * replaced by the on-dashboard tour on 2026-08-04, and existing devices are
 * MEANT to meet the new thing once. The old key is dead weight in
 * AsyncStorage, harmlessly.
 */
const keyFor = (userId: string) => `tour.v1.${userId}`;

export async function tourSeen(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) !== null;
  } catch {
    // Storage failing must read as "seen" — the recoverable direction. The
    // wrong default here traps someone in a tour on every launch.
    return true;
  }
}

export async function markTourSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), new Date().toISOString());
  } catch {
    // Failing to persist means it may show again once. Harmless.
  }
}

/**
 * "Run the tour now", requested from another screen.
 *
 * Settings → About offers the tour again, but the tour lives ON the dashboard
 * — it spotlights that screen's real elements — so About cannot render it,
 * only ask for it. A store rather than a route param because the dashboard is
 * a tab that already exists; `router.navigate` re-shows it rather than
 * re-mounting it, so params would not reliably arrive.
 *
 * The dashboard consumes the request (sets it back to false) the moment it
 * acts on it, and quietly drops it if the takeover is up — the one screen the
 * tour must never cover.
 */
export const tourRequest = createStore(false);

export const requestTour = () => tourRequest.set(true);

/**
 * The running tour's step index, or null when no tour is up.
 *
 * A store rather than screen state because the tour CROSSES screens: it walks
 * the dashboard, then History, then Proof, then closes back on Home. Each of
 * those screens mounts its own overlay for the steps it owns, and this is the
 * one index they all read — the overlay whose screen matches the current
 * step's renders, the rest render nothing.
 *
 * Owned by components/tour.tsx (which defines the steps); screens should not
 * set it directly — `startTour()` / the overlay's own advance are the writers.
 */
export const tourStep = createStore<number | null>(null);

export const startTour = () => tourStep.set(0);
