import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { PUSH_CHANNEL, REMINDER_CHANNEL } from "@four/core";
import { ensureChannels } from "./push";

/**
 * The daily reminder — a local notification, scheduled on this device.
 *
 * This is the opposite of the pager. The pager lives on the server, fires when
 * the system is DOWN, and cannot be turned off; the reminder is a quiet local
 * nudge at a time the user chose, off by default, because the monitor is a
 * pager, not a nag. `system_state.daily_reminder_at` (a Postgres `time`, null
 * = off) is the source of truth so every device the account signs into agrees;
 * the schedule itself is per-device, which is what a lock-screen nudge is.
 *
 * Local scheduling needs no push token and no EAS project, so unlike the
 * pager it works in Expo Go today.
 */

const REMINDER_ID = "daily-reminder";

export type ReminderSync = { ok: true } | { ok: false; reason: string };

/** "21:00:00" (Postgres `time`) → { hour: 21, minute: 0 }. */
function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(":");
  return { hour: Number(h) || 0, minute: Number(m) || 0 };
}

/** "21:00:00" → "21:00", for display. */
export const reminderLabel = (t: string) => t.slice(0, 5);

async function schedule(time: string) {
  const { hour, minute } = parseTime(time);
  // The channel must exist before anything is posted to it, and this path
  // never touches `registerForPush` — a reminder needs no token and no EAS
  // project. A no-op on iOS and on a channel that already exists.
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: "four",
      // A nudge in the register, not a page and not a cheer.
      body: "One small real thing keeps the day up.",
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      // Its OWN channel, not the pager's. The user can silence the nightly
      // nudge without silencing an outage alert — see `REMINDER_CHANNEL`.
      channelId: REMINDER_CHANNEL,
    },
  });
}

/**
 * Make the device match the setting. Called when the user changes it.
 *
 * This is the only reminder path allowed to show the OS permission prompt —
 * the user just asked for a notification, so asking to send notifications is
 * exactly what they expect to happen next.
 */
export async function syncReminder(time: string | null): Promise<ReminderSync> {
  await cancelReminder();
  if (time === null) return { ok: true };

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") {
    return { ok: false, reason: "notifications not permitted" };
  }

  await schedule(time);
  return { ok: true };
}

/**
 * Make the device match the setting, silently. Called on app start.
 *
 * Covers the OS losing the schedule (reinstall, another device wrote a new
 * time) without ever prompting — a permission dialog appearing at launch,
 * apropos of nothing, is exactly the wrong first impression. If permission is
 * missing, the Alerts screen says so instead.
 */
export async function reconcileReminder(time: string | null): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const existing = all.find((r) => r.identifier === REMINDER_ID);

    if (time === null) {
      if (existing) await cancelReminder();
      return;
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const { hour, minute } = parseTime(time);
    if (existing && triggerMatches(existing.trigger, hour, minute)) return;

    await cancelReminder();
    await schedule(time);
  } catch {
    // A reconciliation that fails changes nothing; the next launch retries.
  }
}

/** On sign-out and account deletion, so the next account inherits nothing. */
export async function cancelReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    // Cancelling a schedule that does not exist is not a failure.
  }
}

/**
 * The trigger read back is not the trigger that was written: iOS reports a
 * `calendar` trigger with `dateComponents`, Android a `daily` one.
 */
function triggerMatches(
  trigger: Notifications.NotificationTrigger,
  hour: number,
  minute: number,
): boolean {
  if (!trigger || typeof trigger !== "object" || !("type" in trigger)) {
    return false;
  }
  if (trigger.type === "calendar") {
    const t = trigger as Notifications.CalendarNotificationTrigger;
    return (
      t.dateComponents.hour === hour &&
      t.dateComponents.minute === minute &&
      t.repeats === true
    );
  }
  if (trigger.type === "daily") {
    const t = trigger as Notifications.DailyNotificationTrigger;
    return t.hour === hour && t.minute === minute;
  }
  return false;
}

/**
 * A page you can look at. Fires a local notification a moment from now, using
 * the same channel and register the real pager uses — a pager you have never
 * seen fire is not a pager. Needs permission but never prompts beyond the OS
 * dialog the Alerts screen already routes through.
 */
export async function sendTestAlert(): Promise<ReminderSync> {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") {
    return { ok: false, reason: "notifications not permitted" };
  }

  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "four — TEST PAGE",
      body: "This is what a page looks like. The real one fires when the system is down.",
      // A test page that arrives quietly is not a test of the page. The real
      // one is sent at `high` priority by the monitor (see `core/push.ts`), so
      // this has to match or it demonstrates the wrong thing — someone would
      // check the pager, see it slide silently into the shade, and conclude
      // the alerts do not work.
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      // The PAGER's channel, deliberately — the point is to show what a real
      // page looks like, and a real page comes through `monitor`.
      channelId: PUSH_CHANNEL,
    },
  });
  return { ok: true };
}
