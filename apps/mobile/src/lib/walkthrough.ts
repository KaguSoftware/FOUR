import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Whether this device has shown the first-open walkthrough.
 *
 * Device-local on purpose, same key shape as the outbox. `system_state` would
 * sync the flag across devices, but "has this PERSON been taught" is not the
 * question — a new phone deserves the tour once even for an old account, and a
 * reinstall reshowing three screens costs nothing. The web app has no
 * walkthrough, so a server column would be a promise only one client keeps.
 *
 * Keyed per user so a shared device teaches each account once, not the first
 * account only.
 */
const keyFor = (userId: string) => `walkthrough.v1.${userId}`;

export async function walkthroughSeen(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) !== null;
  } catch {
    // Storage failing must read as "seen" — the recoverable direction. The
    // wrong default here traps someone in a tour on every launch.
    return true;
  }
}

export async function markWalkthroughSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), new Date().toISOString());
  } catch {
    // Failing to persist means it may show again once. Harmless.
  }
}
