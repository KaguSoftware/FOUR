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

/**
 * Forget that this device has seen the guide, so it auto-opens again.
 *
 * Settings → About already has a row that OPENS the guide on demand, which is
 * the answer for someone who wants to reread it. This is the different
 * question: does the first-launch behaviour itself still work? That path runs
 * once per install and is therefore the hardest thing in the app to retest —
 * short of deleting and reinstalling, there was no way to see it twice.
 *
 * Returns whether the flag was actually cleared, so the caller can report a
 * storage failure rather than claiming success. A reset that silently did
 * nothing would send someone off to relaunch the app for no reason.
 */
export async function resetWalkthrough(userId: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
    return true;
  } catch {
    return false;
  }
}
