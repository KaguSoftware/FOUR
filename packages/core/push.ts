/**
 * Native push, replacing Telegram.
 *
 * This file owns **what to send and how to read the answer**. It does not own
 * the transport: `fetch` is not in this package's `lib`, deliberately, because
 * core must stay renderer- and runtime-agnostic. The caller does the HTTP —
 * see `apps/web/lib/push.ts`, which keeps the exact `sendPage(token, text,
 * deepLink)` signature `lib/telegram.ts` had, so the monitor route barely
 * changes and `monitor.ts`'s escalation ladder is untouched.
 *
 * The register does not change because the channel did. A page is plain text,
 * no emoji, no decoration — the same flat treatment for "DOWN 3 DAYS" as for
 * "18 DAYS UP". That symmetry is what stops good news reading as praise.
 */

export const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** Expo push tokens look like `ExponentPushToken[xxxxxxxx]`. */
const TOKEN_SHAPE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export function isPushToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_SHAPE.test(token);
}

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  /** Tapping the notification lands here — the takeover, when down. */
  data: { url?: string };
  sound: "default" | null;
  /** Android only. `high` is what gets a heads-up banner while the phone is idle. */
  priority: "default" | "high";
  channelId: string;
};

/**
 * The Android notification channel.
 *
 * One channel, named for what it is. Android lets the user mute channels
 * individually, and splitting "you are fading" from "you hit 30 days" would let
 * someone mute exactly the half the product exists to deliver.
 */
export const PUSH_CHANNEL = "monitor";

/**
 * Split a page into a notification title and body.
 *
 * `evaluateFade` composes multi-line text whose first line is already the
 * headline — `DOWN 3 DAYS`, then a blank line, then the playbook. A notification
 * wants those as two fields, and this is the only place that mapping lives so
 * the two clients cannot disagree about it.
 */
export function splitPage(text: string): { title: string; body: string } {
  const lines = text.split("\n");
  const title = (lines[0] ?? "").trim();
  const body = lines.slice(1).join("\n").trim();
  // A single-line page is all title and no body on Android, which renders as an
  // empty second row. Moving it to the body and titling it with the product
  // name is the lesser evil.
  return body ? { title, body } : { title: "uptime", body: title };
}

export function pushMessage(
  token: string,
  text: string,
  deepLink?: string,
): PushMessage {
  const { title, body } = splitPage(text);
  return {
    to: token,
    title,
    body,
    data: deepLink ? { url: deepLink } : {},
    sound: "default",
    // These arrive on a lock screen, unprompted, and that channel is part of
    // the product rather than a notification setting. A page that waits for the
    // next unlock is a page that did not do its job.
    priority: "high",
    channelId: PUSH_CHANNEL,
  };
}

export type PushResult = {
  ok: boolean;
  error?: string;
  /**
   * The token is dead — the app was uninstalled, or the OS rotated it. The
   * caller must null it, or every subsequent pass retries a token that can
   * never succeed.
   */
  deviceUnregistered: boolean;
};

/**
 * Interpret Expo's response.
 *
 * Expo returns HTTP 200 with per-message tickets, so a failed send looks like a
 * success at the transport layer. Reading the ticket is not optional — skip it
 * and a dead token silently swallows every page from then on, which is the
 * worst failure this system can have: it looks like nothing is wrong.
 */
export function readPushResponse(payload: unknown): PushResult {
  const data = (payload as { data?: unknown })?.data;
  const ticket = Array.isArray(data) ? data[0] : data;

  if (!ticket || typeof ticket !== "object") {
    return { ok: false, error: "malformed push response", deviceUnregistered: false };
  }

  const { status, message, details } = ticket as {
    status?: string;
    message?: string;
    details?: { error?: string };
  };

  if (status === "ok") return { ok: true, deviceUnregistered: false };

  return {
    ok: false,
    error: message ?? "push rejected",
    deviceUnregistered: details?.error === "DeviceNotRegistered",
  };
}
