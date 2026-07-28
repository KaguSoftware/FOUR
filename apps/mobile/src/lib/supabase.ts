import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

/**
 * The Supabase client.
 *
 * Two things here are load-bearing and easy to get wrong.
 *
 * **1. Tokens go in the keychain, never in AsyncStorage.** AsyncStorage is
 * plain, world-readable-on-a-rooted-device storage. A session token is a
 * bearer credential for someone's account, so it belongs in Keychain /
 * EncryptedSharedPreferences, which is what `expo-secure-store` wraps.
 *
 * **2. SecureStore caps a value at 2048 bytes on Android**, and a Supabase
 * session — access token, refresh token, and the user object — is comfortably
 * larger than that. Writing it straight in fails, and it fails *silently
 * enough* to look like "the app randomly logs me out". The adapter below
 * chunks across several keys and reassembles on read.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;

/**
 * The publishable key (`sb_publishable_…`), matching the name `apps/web` uses.
 * Falls back to the older `ANON_KEY` name so a project on legacy keys still
 * works — they occupy the same position in `createClient`.
 *
 * Public by design, and inlined into the bundle either way. RLS
 * (`auth.uid() = user_id`, on all eight tables) is what actually protects the
 * data. The SERVICE ROLE key bypasses RLS and must never appear in this app.
 */
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !publishableKey) {
  // Loud and early. A client built without these fails on the first request
  // with an opaque network error, which is a miserable thing to debug on a
  // device.
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Copy apps/mobile/.env.example to .env.local and fill it in.",
  );
}

/**
 * Under the 2048-byte Android ceiling with room to spare. Session payloads are
 * base64url, so one character is one byte; the margin covers the manifest and
 * any future field Supabase adds to the session object.
 */
const CHUNK_SIZE = 1536;
const MANIFEST = /^__chunked_v1:(\d+)$/;

const chunkKey = (key: string, i: number) => `${key}.${i}`;

async function clearChunks(key: string) {
  const head = await SecureStore.getItemAsync(key);
  const match = head && MANIFEST.exec(head);
  if (!match) return;
  const count = Number(match[1]);
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
}

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const head = await SecureStore.getItemAsync(key);
    if (head === null) return null;

    const match = MANIFEST.exec(head);
    // Not chunked: either a small value or one written by an older build.
    if (!match) return head;

    const count = Number(match[1]);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      // A missing chunk means a partially-written session. Returning half a
      // token would present as an unexplained auth failure on every request;
      // treating it as "no session" sends the user to sign-in, which is the
      // honest outcome and is recoverable.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    // Always clear the previous write first. A shorter session replacing a
    // longer one would otherwise leave orphan chunks that a later, longer
    // write could read back as its own.
    await clearChunks(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    // Manifest last: until it lands, a read sees the OLD value or nothing,
    // never a half-assembled new one.
    await SecureStore.setItemAsync(key, `__chunked_v1:${count}`);
  },

  async removeItem(key: string): Promise<void> {
    await clearChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(url, publishableKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL to detect on native. Leaving this on makes the client parse
    // window.location, which does not exist here.
    detectSessionInUrl: false,
  },
});

/**
 * Refresh tokens only while the app is actually in front of someone.
 *
 * Without this, the timer keeps firing in the background, burns battery, and
 * on iOS gets suspended mid-flight anyway — which leaves the client believing
 * it refreshed when it did not.
 */
let appStateSubscription: { remove: () => void } | null = null;

export function startSessionAutoRefresh() {
  if (appStateSubscription) return;

  if (AppState.currentState === "active") supabase.auth.startAutoRefresh();

  appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
