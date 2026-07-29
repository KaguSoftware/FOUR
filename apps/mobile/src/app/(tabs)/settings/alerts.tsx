import { useCallback, useState } from "react";
import { Alert, Linking, View } from "react-native";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import {
  addDays,
  POSTURE_CHOICES,
  POSTURE_FOOTNOTE,
  type Posture,
} from "@uptime/core";

import { Body, Label } from "@/components/ui";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
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
import { color, space } from "@/theme";

/** Local overrides held only until the server confirms them. */
type Pending = {
  slammed?: boolean;
  posture?: Posture;
  reminder?: string | null;
};

const DEFAULT_REMINDER = "21:00:00";

/**
 * How the system talks to you, and when.
 *
 * Posture lives here and ONLY here — deliberately not on the takeover, even
 * though someone having a bad week is exactly who would benefit from switching.
 * Offering it there turns a rough moment into a configuration task.
 *
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

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  const { state } = status;

  // A control moves the instant it is tapped.
  //
  // These used to read straight from server state, so nothing moved until a
  // write AND a five-query reload had both come back — seconds, on a phone, for
  // a toggle. The local view flips first and only reverts if the write actually
  // fails, which is the honest version of optimistic: the UI is ahead of the
  // server, never lying about it.
  const slammed = pending.slammed ?? status.slammed;
  const posture = pending.posture ?? state.posture;
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
      <Label style={{ marginBottom: space[3] }}>posture</Label>
      <Segmented
        label="Alert posture"
        options={POSTURE_CHOICES}
        value={posture}
        onChange={(next) => update({ posture: next }, { posture: next })}
      />

      {/* Only the SELECTED option's detail. Two descriptions on screen is a
          comparison, and this is a setting you already made. The footnote stays
          in full: core marks it load-bearing, because without it `soft` reads as
          the easier setting, and the whole point is that there is no easier
          setting. */}
      <Note>
        {POSTURE_CHOICES.find((c) => c.value === posture)?.detail}{" "}
        {POSTURE_FOOTNOTE}
      </Note>

      <Group title="thresholds">
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
          ? `Raised thresholds until ${state.slammed_until}. Still one lever, still ten minutes of anything.`
          : "For genuinely overloaded stretches. Raises the alert thresholds; never pauses the system. Expires on its own after 14 days."}
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
      <Note>
        Off by default — the monitor is a pager, not a nag. When on, this
        device nudges you once a day at the time you pick. Nothing is sent
        anywhere.
      </Note>

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
      <Note>
        Pages arrive on the lock screen when the system has been down. A pager
        you have never seen fire is not a pager — send yourself a test.
      </Note>

      <Body
        tone="mute"
        style={{ fontSize: 12, lineHeight: 18, marginTop: space[8] }}
      >
        Neither posture nor slammed mode changes what counts as up, any number
        on any screen, or when the pager fires. The pager itself has no off
        switch — it is the product.
      </Body>
    </Screen>
  );
}
