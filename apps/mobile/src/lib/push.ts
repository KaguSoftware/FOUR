import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { PUSH_CHANNEL } from "@uptime/core";
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
 */
export async function registerForPush(userId: string): Promise<PushRegistration> {
  // A simulator cannot receive a push, and asking there returns an error that
  // reads like a real failure.
  if (!Device.isDevice) {
    return { ok: false, reason: "push needs a physical device" };
  }

  if (Platform.OS === "android") {
    // Android requires the channel to exist before a notification can use it,
    // and the channel — not the message — owns importance and the LED colour.
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
      name: "Monitor",
      description:
        "Alerts when the system has been down, and the occasional milestone.",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: color.degraded,
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
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
