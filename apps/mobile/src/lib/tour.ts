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
