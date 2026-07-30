import { useCallback, useState } from "react";
import { Alert, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { addDays } from "@uptime/core";

import { Loading } from "@/components/states";
import { Screen } from "@/components/screen";
import {
  ActionRow,
  Group,
  Note,
  RowRule,
  SwitchRow,
  TimeRow,
  ValueRow,
} from "@/components/settings-ui";
import { cancelReminder, sendTestAlert, syncReminder } from "@/lib/reminder";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";

/** Local overrides held only until the server confirms them. */
type Pending = {
  slammed?: boolean;
  reminder?: string | null;
};

const DEFAULT_REMINDER = "21:00:00";

/**
 * Two channels share this screen and must not blur: the PAGER is the server's,
 * fires when the system is down, and has no off switch — that channel is the
 * product. The REMINDER is a local nudge at a chosen time, off by default,
 * because the monitor is a pager, not a nag.
 */
export default function AlertsScreen() {
  const { status, refresh } = useStatus();
  const [pending, setPending] = useState<Pending>({});
  const [permission, setPermission] = useState<string | null>(null);

  // Re-read on every focus: the user may have just changed it in iOS Settings,
  // and a stale "off" here would look like the app disagreeing with the OS.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      Notifications.getPermissionsAsync().then(
        (p) => live && setPermission(p.status),
      );
      return () => {
        live = false;
      };
    }, []),
  );

  if (!status) return <Loading />;
  const { state } = status;

  // A control moves the instant it is tapped.
  //
  // These used to read straight from server state, so nothing moved until a
  // write AND a five-query reload had both come back — seconds, on a phone, for
  // a toggle. The local view flips first and only reverts if the write actually
  // fails, which is the honest version of optimistic: the UI is ahead of the
  // server, never lying about it.
  const slammed = pending.slammed ?? status.slammed;
  const reminder =
    pending.reminder !== undefined ? pending.reminder : state.daily_reminder_at;

  async function update(patch: Record<string, unknown>, optimistic: Pending) {
    setPending((p) => ({ ...p, ...optimistic }));
    const { error } = await supabase
      .from("system_state")
      .update(patch)
      .eq("user_id", state.user_id);

    const drop = () =>
      setPending((p) => {
        const next = { ...p };
        for (const k of Object.keys(optimistic)) delete next[k as keyof Pending];
        return next;
      });

    if (error) {
      // Put it back. A switch that stays on after a failed write is a lie the
      // user only discovers later, when the monitor behaves unexpectedly.
      drop();
      Alert.alert("Didn't save", "That change didn't reach the server.");
      return false;
    }

    // Hold the optimistic value until the reload lands, THEN drop it. Dropping
    // first would flash the old value for the length of the round trip.
    await refresh();
    drop();
    return true;
  }

  async function setReminder(time: string | null) {
    if (time !== null) {
      // Permission first, write second. The user just asked for a
      // notification, so the OS prompt lands in context — and a denied prompt
      // writes nothing, so the server never claims a reminder that cannot
      // fire.
      const sync = await syncReminder(time);
      if (!sync.ok) {
        Alert.alert(
          "Notifications are off",
          "Turn them on for four in iOS Settings, then try again.",
        );
        setPermission("denied");
        return;
      }
      setPermission("granted");
      const saved = await update(
        { daily_reminder_at: time },
        { reminder: time },
      );
      // The server is the source of truth; a schedule it does not know about
      // must not survive.
      if (!saved) await cancelReminder();
      return;
    }

    await cancelReminder();
    await update({ daily_reminder_at: null }, { reminder: null });
  }

  async function onTestAlert() {
    const res = await sendTestAlert();
    if (!res.ok) {
      Alert.alert(
        "Notifications are off",
        "Turn them on for four in iOS Settings, then try again.",
      );
      setPermission("denied");
    }
  }

  const permissionLabel =
    permission === "granted"
      ? "Allowed"
      : permission === "denied"
        ? "Off"
        : "Not asked yet";

  return (
    <Screen underHeader>
      <Group title="thresholds" first>
        <SwitchRow
          title="Slammed mode"
          value={slammed}
          onValueChange={(on) =>
            update(
              { slammed_until: on ? addDays(status.today, 14) : null },
              { slammed: on },
            )
          }
        />
      </Group>
      <Note>
        {slammed
          ? // The date the OPTIMISTIC switch implies, not just the server's.
            // `slammed` flips on tap while `slammed_until` stays null until the
            // write and the reload both land, so interpolating the column alone
            // read "Raised thresholds until null." for the whole round trip.
            // The fallback is the same expression the write sends.
            `Raised thresholds until ${state.slammed_until ?? addDays(status.today, 14)}.`
          : "Raises the alert thresholds for 14 days. Never pauses the system."}
      </Note>

      <Group title="daily reminder">
        <SwitchRow
          title="Remind me daily"
          value={reminder !== null}
          onValueChange={(on) => setReminder(on ? DEFAULT_REMINDER : null)}
        />
        {reminder !== null && (
          <>
            <RowRule />
            <TimeRow title="Time" value={reminder} onChange={setReminder} />
          </>
        )}
      </Group>

      <Group title="delivery">
        {permission === "denied" ? (
          <ActionRow
            title="Notifications off — open iOS Settings"
            onPress={() => Linking.openSettings()}
          />
        ) : (
          <ValueRow title="Notifications" value={permissionLabel} />
        )}
        <RowRule />
        <ActionRow title="Send a test alert" onPress={onTestAlert} />
      </Group>
      <Note>The pager has no off switch — it is the product.</Note>
    </Screen>
  );
}
