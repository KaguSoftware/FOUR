import { useState } from "react";
import { Alert, View } from "react-native";
import {
  addDays,
  POSTURE_CHOICES,
  POSTURE_FOOTNOTE,
  type Posture,
} from "@uptime/core";

import { Body, Label } from "@/components/ui";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Group, Note, SwitchRow } from "@/components/settings-ui";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";
import { color, space } from "@/theme";

/** Local overrides held only until the server confirms them. */
type Pending = { slammed?: boolean; posture?: Posture };

/**
 * How the system talks to you, and when.
 *
 * Posture lives here and ONLY here — deliberately not on the takeover, even
 * though someone having a bad week is exactly who would benefit from switching.
 * Offering it there turns a rough moment into a configuration task.
 */
export default function AlertsScreen() {
  const { status, refresh } = useStatus();
  const [pending, setPending] = useState<Pending>({});

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
      return;
    }

    // Hold the optimistic value until the reload lands, THEN drop it. Dropping
    // first would flash the old value for the length of the round trip.
    await refresh();
    drop();
  }

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

      <Body
        tone="mute"
        style={{ fontSize: 12, lineHeight: 18, marginTop: space[8] }}
      >
        Neither setting changes what counts as up, any number on any screen, or
        when the pager fires.
      </Body>
    </Screen>
  );
}
