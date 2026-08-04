import {
  EXPO_PUSH_ENDPOINT,
  isPushToken,
  pushMessage,
  readPushResponse,
  type PushResult,
} from "@four/core";

/**
 * The push transport.
 *
 * Keeps the exact signature `lib/telegram.ts` has — `(token, text, deepLink)`
 * returning `{ ok, error }` — so the monitor route treats a phone and a chat as
 * the same kind of channel and `monitor.ts`'s escalation ladder never learns
 * which one it is talking to.
 *
 * Everything about *what* to send and *how to read the answer* lives in
 * `@four/core/push`, where it is unit-tested. This file is only the fetch.
 */
export async function sendPush(
  token: string,
  text: string,
  deepLink?: string,
): Promise<PushResult> {
  if (!isPushToken(token)) {
    return { ok: false, error: "not an expo push token", deviceUnregistered: false };
  }

  try {
    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        // Expo compresses responses by default; being explicit keeps the body
        // parseable without a content-encoding surprise.
        "accept-encoding": "gzip, deflate",
      },
      body: JSON.stringify([pushMessage(token, text, deepLink)]),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `expo push ${res.status}: ${await res.text()}`,
        deviceUnregistered: false,
      };
    }

    // Expo answers 200 even when the message was rejected, so the ticket is
    // the only real answer. Trusting res.ok would let a dead token swallow
    // every page from here on while looking healthy.
    return readPushResponse(await res.json());
  } catch (e) {
    return { ok: false, error: String(e), deviceUnregistered: false };
  }
}
