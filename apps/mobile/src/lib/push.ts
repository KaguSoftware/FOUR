import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { PUSH_CHANNEL, REMINDER_CHANNEL } from "@four/core";
import { supabase } from "./supabase";
import { color } from "@/theme";

/**
 * Push registration.
 *
 * The escalation ladder lives on the server and does not change: silent below
 * 2 days down (3 in slammed mode), level 1 at 2, level 2 at 3 with the playbook
 * attached, level 3 weekly past 7. One page per day maximum. All this file does
 * is get a token to `system_state.push_token` so the monitor has somewhere to
 * send it.
 */

/**
 * A page arriving while the app is open still shows.
 *
 * The alert is the product, not a notification setting — and a page you only
 * see if you happen to be elsewhere is a page that can be missed by paying
 * attention, which is backwards.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Declare both Android channels. Safe to call repeatedly; a no-op elsewhere.
 *
 * This used to live inside `registerForPush`, which meant the channels only
 * existed once the user had accepted push — and the daily reminder needs
 * neither a token nor an EAS project, so on a device that had declined push
 * the reminder was posted to a channel that had never been declared. Android's
 * behaviour there is to fall back to a default channel the user cannot find in
 * settings, or to drop it.
 *
 * **A channel's settings are fixed at creation.** Android deliberately ignores
 * importance, sound and vibration on any later call for the same id, so the
 * user's own changes cannot be overwritten by an app update. Getting these
 * wrong the first time means the only fix is a new channel id.
 */
export async function ensureChannels() {
  if (Platform.OS !== "android") return;

  // The pager. HIGH is what earns a heads-up banner while the phone is idle,
  // which is the entire point — a page you only see by unlocking is not one.
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
    name: "Monitor",
    description:
      "Alerts when the system has been down, and the occasional milestone.",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: color.degraded,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // The opt-in nudge. DEFAULT, so it lands in the shade without interrupting
  // — it is a reminder at a time the user chose, not news. See the docblock on
  // `REMINDER_CHANNEL` in core for why this is a separate channel at all.
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: "Daily reminder",
    description:
      "The optional nudge at the time you picked. Off unless you turn it on.",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: color.degraded,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export type PushRegistration =
  | { ok: true; token: string }
  | { ok: false; reason: string };

/**
 * Ask for permission, get a token, store it.
 *
 * Deliberately NOT called on first launch. Asking for notification permission
 * before someone has logged a single day spends the one prompt iOS gives you on
 * a stranger — it is called after onboarding, when the user has chosen levers
 * and the alerts have something to be about.
 *
 * **`prompt` splits the two callers**, the same way `reminder.ts` splits
 * `syncReminder` from `reconcileReminder`. Onboarding and the Alerts screen
 * ask deliberately, in response to something the user just did. Every other
 * caller — notably the tab layout, which runs on every mount — passes
 * `prompt: false` and only refreshes a token that permission already exists
 * for. Without that split, someone who chose "not now" during onboarding got
 * the OS dialog anyway the moment the tabs mounted, which is precisely the
 * out-of-context prompt the onboarding step was written to avoid.
 */
export async function registerForPush(
  userId: string,
  { prompt = true }: { prompt?: boolean } = {},
): Promise<PushRegistration> {
  // A simulator cannot receive a push, and asking there returns an error that
  // reads like a real failure.
  if (!Device.isDevice) {
    return { ok: false, reason: "push needs a physical device" };
  }

  await ensureChannels();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    if (!prompt) return { ok: false, reason: "notifications not permitted" };
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") {
    // Not an error. The app works without alerts; it just cannot catch a fade
    // for someone who is not opening it, which is the case alerts exist for.
    return { ok: false, reason: "notifications not permitted" };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    // Expo cannot issue a token without one. This is a build-configuration
    // problem, not a user-facing one — see HANDOFF: `eas init` has not run.
    return { ok: false, reason: "no EAS projectId; run `eas init`" };
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const { error } = await supabase
      .from("system_state")
      .update({ push_token: token, push_platform: Platform.OS })
      .eq("user_id", userId);

    if (error) return { ok: false, reason: "could not store the token" };
    return { ok: true, token };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/** Stop pages to this device without touching anything else on the account. */
export async function unregisterPush(userId: string) {
  return supabase
    .from("system_state")
    .update({ push_token: null, push_platform: null })
    .eq("user_id", userId);
}
