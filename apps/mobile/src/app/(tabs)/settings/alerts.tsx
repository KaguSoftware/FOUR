import { useCallback, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { addDays, clampBoundaryHour } from "@four/core";

import { useNotify } from "@/components/snackbar";
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
import { setBoundaryHour } from "@/lib/status";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";

/** Local overrides held only until the server confirms them. */
type Pending = {
  slammed?: boolean;
  reminder?: string | null;
  boundary?: number;
};

const DEFAULT_REMINDER = "21:00:00";

/**
 * What to call the place the user has to go.
 *
 * Three strings on this screen said "iOS Settings" outright. On an Android
 * phone that names an app the user does not have, about a switch that is
 * genuinely somewhere else — the one moment this copy is read is the moment
 * it has to be right, because the user is being sent to find something.
 */
const SYSTEM_SETTINGS = Platform.OS === "ios" ? "iOS Settings" : "Settings";

/** "Notifications are off" — the same message from three places. */
const PERMISSION_OFF = `Turn them on for four in ${SYSTEM_SETTINGS}, then try again.`;

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
  const notify = useNotify();

  /**
   * "Notifications are off", from the three places that can discover it.
   *
   * On Android it carries the fix as a snackbar action, which is the Material
   * shape for a message the user can do something about — one tap straight to
   * the app's notification settings rather than a dialog telling them to go
   * find it themselves. On iOS `useNotify` falls through to the Alert this
   * screen already showed.
   */
  const permissionOff = useCallback(
    () =>
      notify("Notifications are off", PERMISSION_OFF, {
        label: "settings",
        onPress: () => Linking.openSettings(),
      }),
    [notify],
  );

  // Re-read on every focus: the user may have just changed it in system
  // settings, and a stale "off" here would look like the app disagreeing
  // with the OS.
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
  const boundary = pending.boundary ?? state.day_boundary_hour;

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
      notify("Didn't save", "That change didn't reach the server.");
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
        permissionOff();
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
      permissionOff();
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

      {/* When the day rolls over.
          Not midnight by default: a 01:30 session belongs to the day that just
          ended, not the one that technically started. It sits with thresholds
          rather than with the reminder because it is a rule about what counts,
          not a notification. */}
      <Group title="the day">
        <TimeRow
          title="A new day starts at"
          // `TimeRow` speaks "HH:MM:SS"; the boundary is whole hours, so the
          // minutes are shown as :00 and thrown away on the way back. A
          // half-past boundary is a complication with no use case.
          value={`${String(boundary).padStart(2, "0")}:00:00`}
          onChange={(time) => {
            const hour = clampBoundaryHour(Number(time.slice(0, 2)));
            if (hour === boundary) return;
            // Local first, so `today()` is right before the reload lands.
            setBoundaryHour(hour);
            update({ day_boundary_hour: hour }, { boundary: hour });
          }}
        />
      </Group>
      <Note>
        Anything logged before {String(boundary).padStart(2, "0")}:00 counts for
        the previous day. Days already logged keep the boundary they were logged
        under — changing this never re-dates your history.
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
            title={`Notifications off — open ${SYSTEM_SETTINGS}`}
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
